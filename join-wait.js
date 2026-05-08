module.exports = function (RED) {
    'use strict';
    const jsonata = require('jsonata');

    const { normalizePaths, hasDuplicatePath, compileRegex } = require('./lib/config');
    const { matchesAny, anyMatches, findAllPathsAnyOrder, findAllPathsExactOrder } = require('./lib/matcher');
    const persist = require('./lib/persist');
    const { resolveContextStore } = require('./lib/store');

    const RESOLVE_FAILED = Symbol('resolve-failed');
    const DEFAULT_GROUP = '_join-wait-node';

    // HTML <select> stores `'true'`/`'false'` strings, but flows constructed
    // programmatically may use real booleans. Accept both.
    function asBool(v) {
        return v === true || v === 'true';
    }

    function JoinWaitNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        // Config: paths can be a real array (new editor) or JSON string (legacy editor).
        node.pathsToWait = normalizePaths(config.paths);
        node.pathsToExpire = normalizePaths(config.pathsToExpire);

        if (Array.isArray(node.pathsToExpire) && hasDuplicatePath(node.pathsToExpire)) {
            node.error(`join-wait pathsToExpire cannot have duplicate entries: ${node.pathsToExpire}`);
            node.status({ fill: 'red', shape: 'ring', text: 'config error' });
            return;
        }

        // Config keys are kept verbatim from 0.5.x flow JSON for back-compat.
        // Internally we use clearer names: pathField (vs pathTopic),
        // ignoreMsgComplete (vs disableComplete), persistQueue (vs persistOnRestart).
        node.exactOrder = asBool(config.exactOrder);
        node.useFirstAsBase = config.firstMsg !== 'false' && config.firstMsg !== false;
        node.mapPayload = asBool(config.mapPayload);
        node.useRegex = config.useRegex === true;
        node.warnUnmatched = config.warnUnmatched === true;
        node.ignoreMsgComplete = config.disableComplete === true;
        node.persistQueue = config.persistOnRestart === true;
        // Resolve effective context store: explicit override wins; otherwise,
        // if Preserve queue is on AND the default store is memory AND a
        // persistent named store exists, auto-pick it so the user doesn't
        // have to point every join-wait node at the same store manually.
        const explicitStore = config.persistStore || undefined;
        node.persistStore = resolveContextStore(RED.settings.contextStorage, explicitStore, node.persistQueue);
        if (node.persistStore && node.persistStore !== explicitStore) {
            node.log(`auto-selected context store '${node.persistStore}' for queue persistence`);
        }

        node.pathField = config.pathTopic || 'topic';
        node.pathFieldType = config.pathTopicType || 'msg';

        node.correlatorType = config.correlationTopicType;
        node.correlator = config.correlationTopic || false;
        if (node.correlatorType === 'jsonata' && node.correlator) {
            try {
                node.correlator = jsonata(node.correlator);
            } catch (err) {
                node.error(`join-wait.invalid-expr topic ${err.message}`);
                node.status({ fill: 'red', shape: 'ring', text: 'invalid correlator' });
                return;
            }
        }

        node.timeout = (Number(config.timeout) || 15000) * (Number(config.timeoutUnits) || 1);

        // ---------- persistence ----------

        const nodeCtx = node.context();

        // node.queues is the per-correlation-group queue dictionary, keyed by
        // correlation value. Exposed for tests; populated asynchronously from
        // the context store so a configured persistent store can be used.
        node.queues = {};
        node._ready = persist.load(nodeCtx, node.persistStore).then((saved) => {
            node.queues = saved;
            // Wipe what we just read; the close handler will re-write if persistOnRestart=true.
            return persist.clear(nodeCtx, node.persistStore).then(() => {
                for (const group of Object.keys(node.queues)) {
                    if (node.persistQueue) {
                        scheduleQueueTimer(group, 10);
                    } else {
                        dropQueue(group);
                    }
                }
                updateStatus();
            });
        });

        node.on('close', function (removed, done) {
            for (const group of Object.keys(node.queues)) {
                clearTimeout(node.queues[group].timeOut);
                if (!node.persistQueue) {
                    dropQueue(group);
                }
            }

            const writeBack = node.persistQueue
                ? persist.save(nodeCtx, node.persistStore, node.queues)
                : persist.clear(nodeCtx, node.persistStore);

            // Always call done — even on a context-store rejection — so
            // Node-RED's shutdown isn't held up indefinitely.
            writeBack.then(
                () => done(),
                /* c8 ignore next */
                (err) => done(err),
            );
        });

        // ---------- input handler ----------

        // Modern Node-RED (msg, send, done) signature:
        //   - `send` is the per-invocation send fn — safer than node.send in
        //     async handlers because it can't fire after shutdown.
        //   - `done()` tells the runtime this message has finished
        //     processing (used for async-message tracking + graceful
        //     shutdown). For a join node, "finished" means *buffered* —
        //     we mark each input done when it's queued or rejected. The
        //     completing message's done() also covers the success emission;
        //     the earlier-queued msgs were already done() at intake.
        node.on('input', async function (msg, send, done) {
            try {
                // Wait for the initial context load before processing — guarantees
                // we don't race the persisted state read with a freshly-arriving msg.
                await node._ready;

                const evalCtx = await buildEvalContext(msg);
                if (!evalCtx) {
                    done();
                    return;
                }

                if (msg.reset === true) {
                    if (Object.prototype.hasOwnProperty.call(node.queues, evalCtx.group)) {
                        dropQueue(evalCtx.group);
                    }
                    updateStatus();
                    done();
                    return;
                }

                if (node.mapPayload) {
                    evalCtx.pathKeys.forEach((k) => {
                        evalCtx.pathTopic[k] = msg.payload;
                    });
                }

                enqueueAndEvaluate(msg, evalCtx, send);
                updateStatus();
                done();
                /* c8 ignore next 5 */
            } catch (err) {
                node.error(`join-wait unhandled: ${err && err.message}`, msg);
                node.status({ fill: 'red', shape: 'ring', text: 'error' });
                done(err);
            }
        });

        // Builds the per-message evaluation context. Returns null after
        // emitting an appropriate error (so the caller just bails).
        async function buildEvalContext(msg) {
            const overrides = resolveOverrides(msg);
            if (!validateOverrides(msg, overrides)) return null;

            const pathTopic = resolvePathTopic(msg);
            if (!pathTopic) return null;

            const patterns = compilePatterns(msg, overrides);
            if (!patterns) return null;

            const pathKeys = Object.keys(pathTopic);
            const foundKeys = pathKeys.filter((k) => matchesAny(k, patterns.wait, overrides.useRegex));
            const hasExpirePath = patterns.expire && anyMatches(pathKeys, patterns.expire, overrides.useRegex);

            if (!hasExpirePath) {
                warnUnmatched(msg, pathKeys, foundKeys);
                if (foundKeys.length === 0) return null;
            }

            const group = await resolveCorrelationGroup(msg);
            if (group === RESOLVE_FAILED) return null;

            return {
                pathTopic,
                pathKeys,
                patterns,
                hasExpirePath,
                useRegex: overrides.useRegex,
                group,
            };
        }

        // Pick a per-message override array, or fall back to the node config.
        function arrayOrFallback(msgValue, nodeValue) {
            if (msgValue === undefined) return nodeValue;
            return Array.isArray(msgValue) ? msgValue : false;
        }

        // Per-message one-shot overrides. None of these mutate node-level state.
        function resolveOverrides(msg) {
            return {
                pathsToWait: Array.isArray(msg.pathsToWait) ? msg.pathsToWait : node.pathsToWait,
                pathsToExpire: arrayOrFallback(msg.pathsToExpire, node.pathsToExpire),
                useRegex: Object.prototype.hasOwnProperty.call(msg, 'useRegex') ? msg.useRegex === true : node.useRegex,
            };
        }

        function validateOverrides(msg, overrides) {
            if (!Array.isArray(overrides.pathsToWait) || overrides.pathsToWait.length === 0) {
                node.error('join-wait pathsToWait must be a defined array.', msg);
                node.status({ fill: 'red', shape: 'ring', text: 'pathsToWait empty' });
                return false;
            }
            if (
                msg.pathsToExpire !== undefined &&
                (!Array.isArray(msg.pathsToExpire) || msg.pathsToExpire.length === 0)
            ) {
                node.error('join-wait pathsToExpire must be undefined or an array.', msg);
                node.status({ fill: 'red', shape: 'ring', text: 'pathsToExpire invalid' });
                return false;
            }
            if (Array.isArray(overrides.pathsToExpire) && hasDuplicatePath(overrides.pathsToExpire)) {
                node.error(`join-wait pathsToExpire cannot have duplicate entries: ${overrides.pathsToExpire}`, msg);
                node.status({ fill: 'red', shape: 'ring', text: 'duplicate expire path' });
                return false;
            }
            return true;
        }

        function resolvePathTopic(msg) {
            const propName = `${node.pathFieldType}.${node.pathField}`;
            const value = RED.util.evaluateNodeProperty(node.pathField, node.pathFieldType, node, msg);

            if (!value) {
                node.error(`join-wait "${propName}" is undefined or not set.`, msg);
                node.status({ fill: 'red', shape: 'ring', text: `${propName} unset` });
                return null;
            }
            if (typeof value === 'string') return { [value]: true };
            if (typeof value !== 'object' || Array.isArray(value)) {
                node.error(`join-wait "${propName}" must be a string or an object, e.g., ${propName} = 'value'.`, [
                    msg,
                    null,
                ]);
                node.status({ fill: 'red', shape: 'ring', text: `${propName} invalid` });
                return null;
            }
            // Shallow-clone — mapPayload would otherwise mutate the caller's object.
            return Object.assign({}, value);
        }

        function compilePatterns(msg, overrides) {
            if (!overrides.useRegex) {
                return { wait: overrides.pathsToWait, expire: overrides.pathsToExpire };
            }
            try {
                return {
                    wait: compileRegex(overrides.pathsToWait),
                    expire: compileRegex(overrides.pathsToExpire),
                };
            } catch (err) {
                node.error(`join-wait.regex-expr ${err.message}`, msg);
                node.status({ fill: 'red', shape: 'ring', text: 'invalid regex' });
                return null;
            }
        }

        function warnUnmatched(msg, pathKeys, foundKeys) {
            if (!node.warnUnmatched) return;
            const propName = `${node.pathFieldType}.${node.pathField}`;
            const unknown = pathKeys.filter((k) => foundKeys.indexOf(k) === -1);
            if (unknown.length === 0) return;
            const list = unknown.map((k) => `${propName}["${k}"]`).join(', ');
            node.warn(`join-wait ${list} doesn't exist in pathsToWait or pathsToExpire!`, msg);
        }

        // jsonata v2 returns a Promise; msg/flow/global types resolve sync.
        async function resolveCorrelationGroup(msg) {
            try {
                if (node.correlatorType === 'jsonata') {
                    return node.correlator ? await node.correlator.evaluate({ msg: msg }) : DEFAULT_GROUP;
                }
                if (node.correlator) {
                    return RED.util.evaluateNodeProperty(node.correlator, node.correlatorType, node, msg);
                }
                return DEFAULT_GROUP;
            } catch (err) {
                node.error(`join-wait.invalid-expr topic ${err.message}`, msg);
                node.status({ fill: 'red', shape: 'ring', text: 'invalid correlator' });
                return RESOLVE_FAILED;
            }
        }

        function enqueueAndEvaluate(msg, evalCtx, send) {
            initQueue(evalCtx.group);
            const queue = node.queues[evalCtx.group];
            queue.queue.push([Date.now(), msg, evalCtx.pathTopic]);

            // If this message hit a reset path, drain everything to the expired
            // output. Otherwise, age out anything that's already past the timeout
            // window (keeps long-idle queues from snowballing). Either drain may
            // empty the queue entirely, in which case we're done.
            if (evalCtx.hasExpirePath) {
                if (flushQueueAsExpired(evalCtx.group)) return;
            } else if (flushTimedOutEntries(evalCtx.group)) {
                return;
            }

            const allPathKeys = queue.queue.map((q) => Object.keys(q[2]));
            const result = node.exactOrder
                ? findAllPathsExactOrder(allPathKeys, evalCtx.patterns.wait, evalCtx.useRegex)
                : findAllPathsAnyOrder(allPathKeys, evalCtx.patterns.wait, evalCtx.useRegex);

            if (!result.matched) {
                if (!flushOnMsgComplete(evalCtx.group, msg)) {
                    flushTrailingEntries(evalCtx.group, result.keep);
                }
                return;
            }

            // All required paths matched — emit success and clear.
            const baseIndex = node.useFirstAsBase ? 0 : queue.queue.length - 1;
            const output = queue.queue[baseIndex][1];
            output[node.pathField] = queue.queue.map((q) => q[2]).reduce((a, b) => Object.assign(a, b), {});
            send([output, null]);
            dropQueue(evalCtx.group);
        }

        // ---------- queue + timer management ----------

        function initQueue(group) {
            if (!Object.prototype.hasOwnProperty.call(node.queues, group)) {
                node.queues[group] = { queue: [] };
                scheduleQueueTimer(group, node.timeout);
            }
        }

        function scheduleQueueTimer(group, delayMs) {
            const entry = node.queues[group];
            entry.timeOut = setTimeout(function () {
                if (flushTimedOutEntries(group)) {
                    updateStatus();
                    return;
                }
                const next = entry.queue[0][0] + node.timeout - Date.now();
                scheduleQueueTimer(group, next);
            }, delayMs);
        }

        // Drain helpers — each returns true if the queue was fully emptied
        // (and removed from node.queues), false if entries remain.
        function dropQueue(group) {
            return drainQueue(group, { sendExpired: false, expireByTime: false, keep: 0 });
        }

        function flushQueueAsExpired(group) {
            return drainQueue(group, { sendExpired: true, expireByTime: false, keep: 0 });
        }

        // `msg.complete` is consulted only when the wait paths haven't yet
        // matched (the call site sits under `if (numToKeep !== null)`). If
        // they have matched, the success path emits + drains and `complete`
        // is irrelevant. Net effect: `complete` short-circuits a partial
        // queue to the expired output, but never overrides a successful
        // match. Set Ignore msg.complete to disable.
        function flushOnMsgComplete(group, msg) {
            if (!node.ignoreMsgComplete && Object.prototype.hasOwnProperty.call(msg, 'complete')) {
                return flushQueueAsExpired(group);
            }
            return false;
        }

        function flushTrailingEntries(group, keep) {
            return drainQueue(group, { sendExpired: true, expireByTime: false, keep: keep });
        }

        function flushTimedOutEntries(group) {
            return drainQueue(group, { sendExpired: true, expireByTime: true, keep: 0 });
        }

        // Pops entries off the front of the group's queue. With `sendExpired`,
        // each popped entry is forwarded to the expired output. With
        // `expireByTime`, popping stops once the head entry is still within
        // the timeout window. Returns true once the queue is empty + removed.
        function drainQueue(group, opts) {
            const entry = node.queues[group];
            const sendExpired = opts.sendExpired;
            const expireByTime = opts.expireByTime;
            const keep = opts.keep;
            const isExpired = () => (expireByTime ? entry.queue[0][0] < Date.now() - node.timeout : true);

            while (entry.queue.length > keep && isExpired()) {
                const popped = entry.queue.shift();
                if (sendExpired) {
                    const out = popped[1];
                    out[node.pathField] = popped[2];
                    node.send([null, out]);
                }
            }

            if (entry.queue.length !== 0) return false;

            clearTimeout(entry.timeOut);
            delete node.queues[group];
            return true;
        }

        function updateStatus() {
            const groups = Object.keys(node.queues);
            if (groups.length === 0) {
                node.status({});
                return;
            }

            // Single group: show progress toward completion ("2/3 received").
            // Multiple groups: aggregate counts since per-group progress would
            // be misleading.
            if (groups.length === 1) {
                const g = groups[0];
                const queued = node.queues[g].queue.length;
                const required = Array.isArray(node.pathsToWait) ? node.pathsToWait.length : 0;
                const text = required > 0 ? `${Math.min(queued, required)}/${required} received` : `queued: ${queued}`;
                node.status({ fill: 'blue', shape: 'dot', text: text });
                return;
            }

            let total = 0;
            for (const g of groups) total += node.queues[g].queue.length;
            node.status({
                fill: 'blue',
                shape: 'dot',
                text: `groups: ${groups.length}, queued: ${total}`,
            });
        }
    }

    RED.nodes.registerType('join-wait', JoinWaitNode);
};

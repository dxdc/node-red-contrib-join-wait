module.exports = function (RED) {
    'use strict';
    let jsonata = require('jsonata');

    RED.nodes.registerType('join-wait', function (config) {
        RED.nodes.createNode(this, config);

        try {
            this.pathsToWait = JSON.parse(config.paths);
        } catch (err) {
            this.pathsToWait = false;
        }

        try {
            this.pathsToExpire = JSON.parse(config.pathsToExpire);
            if (hasDuplicatePath(this.pathsToExpire)) {
                this.error('join-wait pathsToExpire cannot have duplicate entries');
                return;
            }
        } catch (err) {
            this.pathsToExpire = false;
        }

        this.exactOrder = config.exactOrder === 'true';
        this.topic = config.correlationTopic || false;
        this.topicType = config.correlationTopicType;
        if (this.topicType === 'jsonata') {
            try {
                this.topic = jsonata(this.topic);
            } catch (err) {
                this.error(`join-wait.invalid-expr topic ${err.message}`);
                return;
            }
        }

        this.pathTopic = config.pathTopic || 'topic';
        this.pathTopicType = config.pathTopicType;

        this.timeout = (Number(config.timeout) || 15000) * (Number(config.timeoutUnits) || 1);
        this.firstMsg = config.firstMsg === 'true';
        this.mapPayload = config.mapPayload === 'true';

        this.useRegex = config.useRegex === true;
        this.warnUnmatched = config.warnUnmatched === true;
        this.disableComplete = config.disableComplete === true;

        this.paths = {};
        let node = this;

        node.on('close', function (removed, done) {
            for (const key in node.paths) {
                if (Object.prototype.hasOwnProperty.call(node.paths, key)) {
                    clearTimeout(node.paths[key].timeOut);
                    delete node.paths[key];
                }
            }
            done();
        });

        node.on('input', function (msg) {
            //
            // error checking
            //

            // pathTopic & pathTopicType

            let pathTopic = RED.util.evaluateNodeProperty(node.pathTopic, node.pathTopicType, node, msg);
            const pathTopicName = `${node.pathTopicType}.${node.pathTopic}`;

            if (!pathTopic) {
                node.error(`join-wait "${pathTopicName}" is undefined or not set.`, [msg, null]);
                return;
            }

            if (typeof pathTopic === 'string') {
                pathTopic = {
                    [pathTopic]: true,
                };
            } else if (typeof pathTopic !== 'object' || Array.isArray(pathTopic)) {
                node.error(
                    `join-wait "${pathTopicName}" must be a string or an object, e.g., ${pathTopicName} = 'value'.`,
                    [msg, null],
                );
                return;
            }

            // pathsToWait & pathsToExpire

            node.pathsToWait = msg.pathsToWait || node.pathsToWait; // update global setting
            if (!node.pathsToWait || !Array.isArray(node.pathsToWait) || !node.pathsToWait.length) {
                node.error('join-wait pathsToWait must be a defined array.', [msg, null]);
                return;
            }

            let pathsToWait = Object.assign([], node.pathsToWait);
            let pathsToExpire = false;

            node.pathsToExpire = msg.pathsToExpire || node.pathsToExpire; // update global setting
            if (node.pathsToExpire) {
                if (!Array.isArray(node.pathsToExpire) || !node.pathsToExpire.length) {
                    node.error('join-wait pathsToExpire must be undefined or an array.', [msg, null]);
                    return;
                }

                pathsToExpire = Object.assign([], node.pathsToExpire);
            }

            if (pathsToExpire && hasDuplicatePath(pathsToExpire)) {
                node.error('join-wait pathsToExpire cannot have duplicate entries: ${pathsToExpire}');
                return;
            }

            node.useRegex = Object.prototype.hasOwnProperty.call(msg, 'useRegex')
                ? msg.useRegex === true
                : node.useRegex; // update global setting
            if (node.useRegex) {
                try {
                    pathsToWait = convertToRegex(pathsToWait);
                    pathsToExpire = convertToRegex(pathsToExpire);
                } catch (err) {
                    node.error(`join-wait.regex-expr ${err.message}`, null);
                    return;
                }
            }

            const pathKeys = Object.keys(pathTopic);
            const hasExpirePath = pathsToExpire && findAnyPath(pathKeys, pathsToExpire, node.useRegex);

            if (!hasExpirePath) {
                const foundKeys = pathKeys.filter(function (val) {
                    return pathsToWait.some(function (p) {
                        return node.useRegex ? p.test(val) : p === val;
                    });
                });

                if (node.warnUnmatched) {
                    const unmatched = pathKeys
                        .filter(function (val) {
                            return foundKeys.indexOf(val) === -1;
                        })
                        .join('", "');
                    if (unmatched) {
                        node.warn(
                            `join-wait ${pathTopicName}["${unmatched}"] doesn't exist in pathsToWait or pathsToExpire!`,
                            [msg, null],
                        );
                    }
                }

                if (foundKeys.length === 0) {
                    return;
                }
            }

            // correlation topic

            let topic;
            try {
                if (node.topicType === 'jsonata') {
                    topic = node.topic.evaluate({
                        msg: msg,
                    });
                } else {
                    topic = node.topic
                        ? RED.util.evaluateNodeProperty(node.topic, node.topicType, node, msg)
                        : '_join-wait-node';
                }
            } catch (err) {
                node.error(`join-wait.invalid-expr topic ${err.message}`);
                return;
            }

            if (node.mapPayload) {
                pathKeys.forEach(function (item) {
                    pathTopic[item] = msg.payload;
                });
            }

            //
            // start processing
            //

            initQueue(topic);
            const group = node.paths[topic];
            group.queue.push([Date.now(), msg, pathTopic]);

            if ((hasExpirePath && clearQueueAllWithOutput(topic)) || clearQueueExpiredByTime(topic)) {
                return;
            }

            const pathData = group.queue.map(function (q) {
                return q[2];
            });
            const allPathKeys = pathData.map(function (q) {
                return Object.keys(q);
            });

            const numToKeep = node.exactOrder
                ? findAllPathsExactOrder(allPathKeys, pathsToWait, node.useRegex)
                : findAllPathsAnyOrder(allPathKeys, pathsToWait, node.useRegex);

            if (numToKeep !== null) {
                clearQueueIfCompleteIsSet(topic, msg) || clearQueueExpiredByOrder(topic, numToKeep);
                return;
            }

            // all paths found

            const num = node.firstMsg ? 0 : group.queue.length - 1;
            let output = group.queue[num][1];
            output[node.pathTopic] = pathData.reduce(function (a, b) {
                return Object.assign(a, b);
            }, {});
            node.send([output, null]);
            clearQueueAllNoOutput(topic);
        });

        function convertToRegex(arr) {
            if (!Array.isArray(arr)) {
                return arr;
            }

            return arr.map(function (pattern) {
                return new RegExp(pattern);
            });
        }

        function flatten(arr) {
            return [].concat.apply([], arr);
        }

        function condenseWithCount(arr) {
            arr = arr.reduce((map, key) => map.set(key, (map.get(key) || 0) + 1), new Map());
            return Array.from(arr, ([name, value]) => ({ name, value }));
        }

        function regexIndexOf(arr, needle) {
            let result = -1;

            arr.some(function (p, i) {
                if (p.test(needle)) {
                    result = i;
                    return true;
                }
            });
            return result;
        }

        function hasDuplicatePath(arr) {
            return arr.some(function (p, index) {
                return arr.indexOf(p) !== index;
            });
        }

        function findAnyPath(msgPaths, arr, useRegex) {
            return msgPaths.some(function (p) {
                if (useRegex) {
                    return arr.some(function (pattern) {
                        return pattern.test(p);
                    });
                } else {
                    return arr.includes(p);
                }
            });
        }

        function findAllPathsAnyOrder(arr, waitPaths, useRegex) {
            const waitMap = condenseWithCount(waitPaths);
            const keys = flatten(arr);
            const result = countPathsAnyOrder(keys, waitMap, useRegex);

            const allPathsFound = result.every(function (p) {
                return p === true;
            });

            if (allPathsFound) {
                return null;
            }

            const originalString = result.toString();

            for (let i = 0; i < arr.length; i++) {
                const newKeys = flatten(arr.slice(i + 1));
                const expireByOne = countPathsAnyOrder(newKeys, waitMap, useRegex);
                if (originalString !== expireByOne.toString()) {
                    return arr.length - i;
                }
            }

            return 0;
        }

        function countPathsAnyOrder(keys, waitMap, useRegex) {
            let used = [];

            return waitMap.map(function (p) {
                const count = keys.filter(function (val, i) {
                    if (used.indexOf(i) !== -1) {
                        return false;
                    }
                    const found = useRegex ? p.name.test(val) : p.name === val;
                    if (!found) {
                        return false;
                    }

                    used.push(i);
                    return true;
                }).length;

                return count < p.value ? count : true;
            });
        }

        function findAllPathsExactOrder(arr, waitPaths, useRegex) {
            let start = 0;
            let marker = false;

            for (let i = 0; i < arr.length; i++) {
                for (let j = 0; j < arr[i].length; j++) {
                    const path = arr[i][j];

                    let offBy = marker === false ? 0 : marker + 1;
                    const unusedWaitPaths = waitPaths.slice(offBy);
                    let index = useRegex ? regexIndexOf(unusedWaitPaths, path) : unusedWaitPaths.indexOf(path);

                    if (index === -1) {
                        if (offBy > 0) {
                            index = useRegex ? regexIndexOf(waitPaths, path) : waitPaths.indexOf(path);
                            if (index > 0) {
                                marker = false;
                            }
                        }
                    } else {
                        index += offBy;
                    }

                    if (index === 0) {
                        start = i;
                    } else if (index === -1 || marker === false) {
                        continue;
                    } else if (index < marker || index > marker + 1) {
                        marker = false;
                        continue;
                    }

                    if (index === waitPaths.length - 1) {
                        return null;
                    }

                    marker = index;
                }
            }

            return marker === false ? 0 : arr.length - start;
        }

        // queue & timer handling

        function initQueue(topic) {
            if (!Object.prototype.hasOwnProperty.call(node.paths, topic)) {
                node.paths[topic] = {
                    queue: [],
                };
                makeNewQueueTimer(topic, node.timeout);
            }
        }

        function makeNewQueueTimer(topic, timeout) {
            const group = node.paths[topic];

            group.timeOut = setTimeout(function () {
                if (clearQueueExpiredByTime(topic)) {
                    return;
                } else {
                    const next = group.queue[0][0] + node.timeout - Date.now();
                    makeNewQueueTimer(topic, next);
                }
            }, timeout);
        }

        // returns boolean if queue is empty (= true)

        function clearQueueAllNoOutput(topic) {
            return _queueDeletionHandler(topic, false, false, 0);
        }

        function clearQueueAllWithOutput(topic) {
            return _queueDeletionHandler(topic, true, false, 0);
        }

        function clearQueueIfCompleteIsSet(topic, msg) {
            if (!node.disableComplete && Object.prototype.hasOwnProperty.call(msg, 'complete')) {
                return clearQueueAllWithOutput(topic);
            }
            return false;
        }

        function clearQueueExpiredByOrder(topic, numToKeep) {
            return _queueDeletionHandler(topic, true, false, numToKeep);
        }

        function clearQueueExpiredByTime(topic) {
            return _queueDeletionHandler(topic, true, true, 0);
        }

        function _queueDeletionHandler(topic, sendExpired, checkExpireTime, numToKeep) {
            const group = node.paths[topic];
            const isExpired = function () {
                return checkExpireTime ? group.queue[0][0] < Date.now() - node.timeout : true;
            };

            while (group.queue.length > numToKeep && isExpired()) {
                const expired = group.queue.shift();
                if (sendExpired) {
                    const msg = Object.assign(expired[1], { paths: expired[2] });
                    node.send([null, msg]);
                }
            }

            if (group.queue.length !== 0) {
                return false;
            }

            clearTimeout(group.timeOut);
            delete node.paths[topic];
            return true;
        }
    });
};

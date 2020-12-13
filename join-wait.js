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
                this.error(`join-wait.invalid-expr ${err.message}`);
                return;
            }
        }

        this.pathTopic = config.pathTopic || 'topic';
        // this.pathTopicType = config.pathTopicType;

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

            if (!msg[node.pathTopic]) {
                node.error(
                    `join-wait "msg.${node.pathTopic}" is undefined, must be msg.${node.pathTopic}["path"]=value.`,
                    [msg, null],
                );
                return;
            }

            if (typeof msg[node.pathTopic] === 'string') {
                msg[node.pathTopic] = {
                    [msg[node.pathTopic]]: true,
                };
            }

            if (typeof msg[node.pathTopic] !== 'object') {
                node.error(
                    `join-wait "msg.${node.pathTopic}" must be a string or an object, e.g., msg.${node.pathTopic}["path"] = value.`,
                    [msg, null],
                );
                return;
            }

            node.pathsToWait = msg.pathsToWait || node.pathsToWait; // update global setting
            if (!node.pathsToWait && !Array.isArray(node.pathsToWait)) {
                node.error('join-wait pathsToWait must be a defined array.', [msg, null]);
                return;
            }
            let pathsToWait = Object.assign([], node.pathsToWait);
            let pathsToExpire = false;

            node.pathsToExpire = msg.pathsToExpire || node.pathsToExpire; // update global setting
            if (node.pathsToExpire) {
                if (!Array.isArray(node.pathsToExpire)) {
                    node.error('join-wait pathsToExpire must be undefined or an array.', [msg, null]);
                    return;
                }

                pathsToExpire = Object.assign([], node.pathsToExpire);
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
                }
            }

            const pathKeys = Object.keys(msg[node.pathTopic]);
            const hasExpirePath = pathsToExpire && findOnePath(pathKeys, pathsToExpire, node.useRegex);

            if (!hasExpirePath) {
                const foundKeys = pathKeys.filter(function (val) {
                    return pathsToWait.some(function (p) {
                        return node.useRegex ? p.test(val) : p === val;
                    });
                });

                if (node.warnUnmatched) {
                    pathKeys
                        .filter(function (val) {
                            return foundKeys.indexOf(val) === -1;
                        })
                        .forEach(function (pathKey) {
                            node.warn(
                                `join-wait msg.${node.pathTopic}["${pathKey}"] doesn't exist in pathsToWait or pathsToExpire!`,
                                [msg, null],
                            );
                        });
                }

                if (foundKeys.length === 0) {
                    return;
                }
            }

            //
            // start processing
            //

            let topic;
            if (node.topicType === 'jsonata') {
                topic = node.topic.evaluate({
                    msg: msg,
                });
            } else {
                topic = node.topic
                    ? RED.util.evaluateNodeProperty(node.topic, node.topicType, node, msg)
                    : '_join-wait-node';
            }

            if (!Object.prototype.hasOwnProperty.call(node.paths, topic)) {
                node.paths[topic] = {
                    queue: [],
                };
                makeNewTimeout(topic, node.timeout);
            }

            node.paths[topic].queue.push([Date.now(), msg]);

            if (hasExpirePath || removeExpiredByTime(topic)) {
                resetQueue(topic, true);
                return;
            }

            const pathData = getReceivedPaths(topic);
            const allPathKeys = pathData.map(function (q) {
                return Object.keys(q);
            });

            let allPathsToWaitFound = false;

            if (node.exactOrder) {
                const numRemaining = findAllPathsExactOrder(allPathKeys, pathsToWait, node.useRegex);

                if (numRemaining !== false) {
                    if (resetQueue(topic, true, numRemaining)) {
                        return;
                    }
                    // still need to check for msg.complete
                } else {
                    allPathsToWaitFound = true;
                }
            } else {
                const flattenedKeys = [].concat.apply([], allPathKeys);
                allPathsToWaitFound = findAllPaths(flattenedKeys, pathsToWait, node.useRegex);
            }

            if (allPathsToWaitFound) {
                const num = node.firstMsg ? 0 : node.paths[topic].queue.length - 1;
                let merged = node.paths[topic].queue[num][1];
                merged[node.pathTopic] = pathData.reduce(function (a, b) {
                    return Object.assign(a, b);
                }, {});
                node.send([merged, null]);

                resetQueue(topic, false);
            } else if (!node.disableComplete && Object.prototype.hasOwnProperty.call(msg, 'complete')) {
                resetQueue(topic, true);
            }
        });

        function convertToRegex(arr) {
            if (!Array.isArray(arr)) {
                return arr;
            }

            return arr.map(function (pattern) {
                return new RegExp(pattern);
            });
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

        function findOnePath(haystack, arr, useRegex) {
            return haystack.some(function (p) {
                if (useRegex) {
                    return arr.some(function (pattern) {
                        return pattern.test(p);
                    });
                } else {
                    return arr.includes(p);
                }
            });
        }

        function findAllPaths(haystack, arr, useRegex) {
            const map = arr.reduce((map, key) => map.set(key, (map.get(key) || 0) + 1), new Map());
            const mapArray = Array.from(map, ([name, value]) => ({ name, value }));

            let used = [];

            return mapArray.every(function (p) {
                const count = haystack.filter(function (val, i) {
                    if (used.indexOf(i) !== -1) {
                        return false;
                    }

                    const found = useRegex ? p.name.test(val) : p.name === val;
                    if (found) {
                        used.push(i);
                    }
                    return found;
                }).length;
                return count >= p.value;
            });
        }

        function findAllPathsExactOrder(haystack, arr, useRegex) {
            let pos = 0;
            let marker = false;

            for (let i = 0; i < haystack.length; i++) {
                const path = haystack[i];

                for (let j = 0; j < path.length; j++) {
                    let offBy = marker === false ? 0 : marker + 1;
                    const pathSlice = arr.slice(offBy);
                    let pathIndex = useRegex ? regexIndexOf(pathSlice, path[j]) : pathSlice.indexOf(path[j]);

                    if (pathIndex === -1) {
                        if (offBy > 0) {
                            pathIndex = useRegex ? regexIndexOf(arr, path[j]) : arr.indexOf(path[j]);
                            if (pathIndex > 0) {
                                marker = false;
                            }
                        }
                    } else {
                        pathIndex += offBy;
                    }

                    if (pathIndex === 0) {
                        pos = i;
                    } else if (pathIndex === -1 || marker === false) {
                        continue;
                    } else if (pathIndex < marker || pathIndex > marker + 1) {
                        marker = false;
                        continue;
                    }

                    if (pathIndex === arr.length - 1) {
                        return false;
                    }

                    marker = pathIndex;
                }
            }

            return marker === false ? 0 : haystack.length - pos;
        }

        function makeNewTimeout(topic, timeout) {
            node.paths[topic].timeOut = setTimeout(function () {
                if (removeExpiredByTime(topic)) {
                    resetQueue(topic, true);
                } else {
                    const nextCheck = node.paths[topic].queue[0][0] + node.timeout - Date.now();
                    makeNewTimeout(topic, nextCheck);
                }
            }, timeout);
        }

        function removeExpiredByTime(topic) {
            const minStartTime = Date.now() - node.timeout;
            while (node.paths[topic].queue.length > 0 && node.paths[topic].queue[0][0] < minStartTime) {
                const expired = node.paths[topic].queue.shift();
                node.send([null, expired[1]]);
            }

            return node.paths[topic].queue.length === 0;
        }

        function getReceivedPaths(topic) {
            return node.paths[topic].queue.map(function (q) {
                if (node.mapPayload) {
                    Object.keys(q[1][node.pathTopic]).forEach(function (item) {
                        q[1][node.pathTopic][item] = q[1].payload;
                    });
                }
                return q[1][node.pathTopic];
            });
        }

        function resetQueue(topic, sendExpired, numRemaining) {
            numRemaining = typeof numRemaining !== 'undefined' ? numRemaining : 0;

            while (node.paths[topic].queue.length > numRemaining) {
                const expired = node.paths[topic].queue.shift();
                if (sendExpired) {
                    node.send([null, expired[1]]);
                }
            }

            if (node.paths[topic].queue.length !== 0) {
                return false;
            }

            clearTimeout(node.paths[topic].timeOut);
            delete node.paths[topic];
            return true;
        }
    });
};

# Node RED join-wait

[![mit license](https://badgen.net/badge/license/MIT/red)](https://github.com/dxdc/node-red-contrib-join-wait/blob/master/LICENSE)
[![npm](https://badgen.net/npm/v/node-red-contrib-join-wait)](https://www.npmjs.com/package/node-red-contrib-join-wait)
[![npm](https://badgen.net/npm/dt/node-red-contrib-join-wait)](https://www.npmjs.com/package/node-red-contrib-join-wait)
[![Donate](https://badgen.net/badge/Donate/PayPal/91BE09)](https://paypal.me/ddcaspi)

This Node-RED module waits for incoming messages from different input paths to arrive within a fixed time window.

> Node-RED is a tool for wiring together hardware devices, APIs and online services in new and interesting ways.

## Description

This node waits for messages from all items in the `Paths (Wait)` array, which must be received inside of a designated time window.

If all of the messages are received in that interval, a merged output is sent to the `success` output. Otherwise, any expired messages are sent to the `timeout` output. Either output can be optionally connected for further processing.

In the event of multiple messages, the time window is adjusted as needed to continue evaluation on subsequent messages. This node has several potential applications, including home automation. For instance, to handle a case where the light turning on/off is also triggering a motion sensor: IF a) light turned OFF, b) motion sensor activated, c) light turned ON all occur within 10 seconds, then turn light OFF.

Memory is managed to delete objects after they reach the `Timeout`.

## Configuration

-   Each item in the `Paths (Wait)` array corresponds with an input path to wait for. E.g., `["path_1", "path_2", "other_path"]`. Each path item must have a unique name.

> This can also be configured at runtime by passing an array using `msg.pathsToWait`.

-   Each item in the `Paths (Expire)` array corresponds with an input path that will immediately expire all messages in the queue without further processing. This acts as a reset. Each path item must have a unique name.

> This can also be configured at runtime by passing an array using `msg.pathsToExpire`.

-   If the `Use regex` option is enabled, each item in the Paths array will be treated as a regular expression.

> This can also be configured at runtime by passing `msg.useRegex` as a boolean.

-   `Paths topic` must be set to a `msg` property, which is used to check each flow to see if all of the elements in `Paths (Wait)` are matched. This can be `msg.topic`, `msg.paths`, etc. If this is not specified, `msg.paths` is the default.

Note that `Paths topic` can be set in one of two ways:

1. As a string, set to the path to check, e.g., `msg.paths = "path_1";`
2. As an object, set to any value (e.g., `msg.paths["path_1"] = {"example": "data"};` or `msg.paths["path_1"] = 42;`).

> If the object format is used, multiple paths can be specified. For example, `msg.paths = {"path_1": true, "path_2": true};` This can be useful if one flow needs to trigger multiple paths.

-   `Correlation topic` can be set, if desired, to ensure that only related messages are grouped. E.g., `msg._msgid` can be used to ensure that only messages from a _single_ split flow are grouped together.

> If left blank, all messages will be assumed to be related.

-   `Timeout` is required to designate the time window to receive all of the messages from `Paths (Wait)`.

-   `Sequence order` defines the criteria to evaluate the received messages. An _exact_ match can be specified, otherwise, it will match them in any order.

> To determine the order, the timestamp on the _latest_ valid `Paths (Wait)` is used, even if multiple messages arrived earlier. In this case of waiting for `["path_1", "path_2", "path_3"]`, the `*` indicates which messages are used: `["path_1", "path_2", "path_1"*, "path_2"*, "path_3"*]`.

-   `Base message` defines which message object should be returned as the base message. Either the first message in a sequence or the last.

-   `Merged data` defines how the data from `msg.paths` (or, another designed `Paths topic`) will be returned. Either, it can be merged in its original form, or, it can be overwritten with each respective `msg.payload`. This merged data is then appended to the `Base message`.

> In the event that multiple messages arrive in this time interval with the same `Paths (Wait)`, only the data from the latest item is returned. For instance, if `Paths (Wait)` = `["path_1", "path_2", "path_3"]`, the `*` indicates which messages are used in this sequence: `["path_1", "path_2", "path_1", "path_2", "path_1"*, "path_2"*, "path_3"*]`. These additional messages (not starred) **will** be expired.

## Notes and Caveats

-   There is support for repeated paths. For example, `["path_1", "path_2", "path_1", "path_2"]`.

> -   If any order is used, `Paths (Wait)` is evaluated to determine the count for repeated paths. If _regex_ is used, paths will be counted in a greedy fashion from left to right. For example, `["path_[12]", "path_2"]` would never complete because all instances of "path_1" and "path_2" would be counted for the first path.

> -   If exact order is used, note that unexpected paths would still be tolerated.

> -   In the case of duplicate paths, only the data from the latest path(s) will be used.

-   If the `regex` option is enabled, each path will be treated as a regular expression. So, `["^path\d+$"]` would match any path1, path2, path3, etc. Note that `^$` are not required, and if omitted, would just perform a partial match. For example `["path\d+"]` would match "my_path1_test". This property can also be set at runtime by passing `msg.useRegex`.

-   If the `msg.complete` property is set, the message queue will be evaluated for completion, and then any remaining items in the queue will be immediately expired. This feature can be disabled in the settings, if desired.

-   All values within `Paths topic` must be contained by either `Paths (Wait)` or `Paths (Expire)`, or an error will be thrown. The `Unmatched paths` error notification can be disabled within the settings.

-   If `msg.pathsToWait` is used instead of setting `Paths (Wait)`, note that each successive `msg.pathsToWait` will overwrite the previously stored global value. Due to the nature of the timeout, `Paths (Wait)` needs to be evaluated even after a message has arrived. Changing the value of `msg.pathsToWait` between messages may cause unexpected behavior.

-   `Timeout` should be padded with a small amount of overhead (i.e., ~5-10 ms or so) for the time it takes to evaluate all of the messages and conditions. This may become critical under very short timeouts.

## Example 1: Wait 5 seconds for input from 2 flows (in any order)

![Example 1](/docs/example1.png?raw=true 'Example 1')

<details><summary>Flow</summary>

```json
[
    {
        "id": "7382168d.c47858",
        "type": "inject",
        "z": "fb783323.7e308",
        "name": "",
        "topic": "topic1",
        "payload": "{\"brightness\":\"20\"}",
        "payloadType": "json",
        "repeat": "",
        "crontab": "",
        "once": false,
        "onceDelay": "",
        "x": 950,
        "y": 1460,
        "wires": [["93c1545b.dca6f8"]]
    },
    {
        "id": "3b8f6807.956d78",
        "type": "debug",
        "z": "fb783323.7e308",
        "name": "",
        "active": true,
        "tosidebar": true,
        "console": false,
        "complete": "true",
        "x": 1610,
        "y": 1320,
        "wires": []
    },
    {
        "id": "5866d421.7eb66c",
        "type": "inject",
        "z": "fb783323.7e308",
        "name": "",
        "topic": "topic1",
        "payload": "",
        "payloadType": "date",
        "repeat": "",
        "crontab": "",
        "once": false,
        "onceDelay": "",
        "x": 960,
        "y": 1380,
        "wires": [["8d0b69cc.b2b228"]]
    },
    {
        "id": "337256a2.04446a",
        "type": "debug",
        "z": "fb783323.7e308",
        "name": "",
        "active": true,
        "tosidebar": true,
        "console": false,
        "tostatus": false,
        "complete": "payload",
        "targetType": "msg",
        "x": 1610,
        "y": 1480,
        "wires": []
    },
    {
        "id": "8d0b69cc.b2b228",
        "type": "change",
        "z": "fb783323.7e308",
        "name": "Set path_1",
        "rules": [{ "t": "set", "p": "paths", "pt": "msg", "to": "path_1", "tot": "str" }],
        "action": "",
        "property": "",
        "from": "",
        "to": "",
        "reg": false,
        "x": 1210,
        "y": 1380,
        "wires": [["959a4717.0b5138"]]
    },
    {
        "id": "93c1545b.dca6f8",
        "type": "change",
        "z": "fb783323.7e308",
        "name": "Set path_2",
        "rules": [{ "t": "set", "p": "paths", "pt": "msg", "to": "path_2", "tot": "str" }],
        "action": "",
        "property": "",
        "from": "",
        "to": "",
        "reg": false,
        "x": 1210,
        "y": 1460,
        "wires": [["959a4717.0b5138"]]
    },
    {
        "id": "959a4717.0b5138",
        "type": "join-wait",
        "z": "fb783323.7e308",
        "name": "",
        "paths": "[\"path_1\", \"path_2\"]",
        "pathsToExpire": "",
        "ignoreUnmatched": false,
        "pathTopic": "paths",
        "pathTopicType": "msg",
        "correlationTopic": "",
        "correlationTopicType": "msg",
        "timeout": "5",
        "timeoutUnits": "1000",
        "exactOrder": "false",
        "firstMsg": "true",
        "mapPayload": "true",
        "disableComplete": false,
        "x": 1420,
        "y": 1400,
        "wires": [["3b8f6807.956d78"], ["337256a2.04446a"]]
    },
    {
        "id": "6ae4802.e40238",
        "type": "comment",
        "z": "fb783323.7e308",
        "name": "(optional) expired messages",
        "info": "",
        "x": 1660,
        "y": 1520,
        "wires": []
    }
]
```

</details>

## Example 2: Wait 5 seconds for input from a split flow (in any order); one message does not arrive in time

-   `_msgid` is used as the **Correlation topic**, so that flows from split queues can be tracked.

![Example 2](/docs/example2.png?raw=true 'Example 2')

<details><summary>Flow</summary>

```json
[
    {
        "id": "c5aae6a2.78f4d8",
        "type": "debug",
        "z": "fb783323.7e308",
        "name": "",
        "active": true,
        "tosidebar": true,
        "console": false,
        "complete": "true",
        "x": 1590,
        "y": 1440,
        "wires": []
    },
    {
        "id": "4644d839.170ac8",
        "type": "inject",
        "z": "fb783323.7e308",
        "name": "",
        "topic": "",
        "payload": "",
        "payloadType": "date",
        "repeat": "",
        "crontab": "",
        "once": false,
        "onceDelay": "",
        "x": 800,
        "y": 1500,
        "wires": [["f785671e.2f1ac8", "2869e698.5a1daa", "373d1571.a4d5fa"]]
    },
    {
        "id": "3ed2d37b.3a852c",
        "type": "debug",
        "z": "fb783323.7e308",
        "name": "",
        "active": true,
        "tosidebar": true,
        "console": false,
        "tostatus": false,
        "complete": "payload",
        "targetType": "msg",
        "x": 1590,
        "y": 1600,
        "wires": []
    },
    {
        "id": "f785671e.2f1ac8",
        "type": "change",
        "z": "fb783323.7e308",
        "name": "Set path_1",
        "rules": [
            { "t": "set", "p": "paths", "pt": "msg", "to": "path_1", "tot": "str" },
            { "t": "set", "p": "payload", "pt": "msg", "to": "true", "tot": "bool" }
        ],
        "action": "",
        "property": "",
        "from": "",
        "to": "",
        "reg": false,
        "x": 1190,
        "y": 1500,
        "wires": [["c492296e.f80428"]]
    },
    {
        "id": "84493c9a.b98f9",
        "type": "change",
        "z": "fb783323.7e308",
        "name": "Set path_2",
        "rules": [{ "t": "set", "p": "paths", "pt": "msg", "to": "path_2", "tot": "str" }],
        "action": "",
        "property": "",
        "from": "",
        "to": "",
        "reg": false,
        "x": 1190,
        "y": 1580,
        "wires": [["c492296e.f80428"]]
    },
    {
        "id": "c492296e.f80428",
        "type": "join-wait",
        "z": "fb783323.7e308",
        "name": "",
        "paths": "[\"path_1\", \"path_2\"]",
        "pathsToExpire": "",
        "pathTopic": "paths",
        "pathTopicType": "msg",
        "correlationTopic": "_msgid",
        "correlationTopicType": "msg",
        "timeout": "5",
        "timeoutUnits": "1000",
        "exactOrder": "false",
        "firstMsg": "true",
        "mapPayload": "true",
        "x": 1400,
        "y": 1520,
        "wires": [["c5aae6a2.78f4d8"], ["3ed2d37b.3a852c"]]
    },
    {
        "id": "a73abdd0.1bd6",
        "type": "comment",
        "z": "fb783323.7e308",
        "name": "(optional) expired messages",
        "info": "",
        "x": 1640,
        "y": 1640,
        "wires": []
    },
    {
        "id": "2869e698.5a1daa",
        "type": "delay",
        "z": "fb783323.7e308",
        "name": "",
        "pauseType": "delay",
        "timeout": "4",
        "timeoutUnits": "seconds",
        "rate": "1",
        "nbRateUnits": "1",
        "rateUnits": "second",
        "randomFirst": "1",
        "randomLast": "5",
        "randomUnits": "seconds",
        "drop": false,
        "x": 1000,
        "y": 1580,
        "wires": [["84493c9a.b98f9"]]
    },
    {
        "id": "373d1571.a4d5fa",
        "type": "delay",
        "z": "fb783323.7e308",
        "name": "",
        "pauseType": "delay",
        "timeout": "7",
        "timeoutUnits": "seconds",
        "rate": "1",
        "nbRateUnits": "1",
        "rateUnits": "second",
        "randomFirst": "1",
        "randomLast": "5",
        "randomUnits": "seconds",
        "drop": false,
        "x": 1000,
        "y": 1640,
        "wires": [["84493c9a.b98f9"]]
    }
]
```

</details>

## Example 3: Wait 5 seconds for input from Events 1A and 1B; Wait 5 seconds for input from Events 2A and 2B; Wait 1 minute for both event groups to complete.

-   Shows an example of how multiple `join-wait` nodes can be chained
-   If Event 3A is received, reset queue

![Example 3](/docs/example3.png?raw=true 'Example 3')

<details><summary>Flow</summary>

```json
[
    {
        "id": "ecf4478b.5bcf28",
        "type": "change",
        "z": "ee7b2f38.64383",
        "name": "Set event_1B",
        "rules": [{ "t": "set", "p": "name", "pt": "msg", "to": "event_1B", "tot": "str" }],
        "action": "",
        "property": "",
        "from": "",
        "to": "",
        "reg": false,
        "x": 760,
        "y": 740,
        "wires": [["fb17fdab.13bc6"]]
    },
    {
        "id": "fb17fdab.13bc6",
        "type": "join-wait",
        "z": "ee7b2f38.64383",
        "name": "",
        "paths": "[\"event_1A\", \"event_1B\"]",
        "pathsToExpire": "",
        "ignoreUnmatched": false,
        "pathTopic": "name",
        "pathTopicType": "msg",
        "correlationTopic": "",
        "correlationTopicType": "msg",
        "timeout": "5",
        "timeoutUnits": "1000",
        "exactOrder": "false",
        "firstMsg": "true",
        "mapPayload": "true",
        "disableComplete": false,
        "x": 960,
        "y": 680,
        "wires": [["8d4ce0e0.362b7"], []]
    },
    {
        "id": "c264c765.36e3c8",
        "type": "change",
        "z": "ee7b2f38.64383",
        "name": "Set event_1A",
        "rules": [{ "t": "set", "p": "name", "pt": "msg", "to": "event_1A", "tot": "str" }],
        "action": "",
        "property": "",
        "from": "",
        "to": "",
        "reg": false,
        "x": 750,
        "y": 660,
        "wires": [["fb17fdab.13bc6"]]
    },
    {
        "id": "6a032c55.883394",
        "type": "delay",
        "z": "ee7b2f38.64383",
        "name": "",
        "pauseType": "delay",
        "timeout": "2",
        "timeoutUnits": "seconds",
        "rate": "1",
        "nbRateUnits": "1",
        "rateUnits": "second",
        "randomFirst": "1",
        "randomLast": "5",
        "randomUnits": "seconds",
        "drop": false,
        "x": 560,
        "y": 740,
        "wires": [["ecf4478b.5bcf28"]]
    },
    {
        "id": "8d4ce0e0.362b7",
        "type": "join-wait",
        "z": "ee7b2f38.64383",
        "name": "",
        "paths": "[\"event_1A\", \"event_1B\", \"event_2A\", \"event_2B\"]",
        "pathsToExpire": "[\"event_3A\"]",
        "ignoreUnmatched": false,
        "pathTopic": "name",
        "pathTopicType": "msg",
        "correlationTopic": "",
        "correlationTopicType": "msg",
        "timeout": "1",
        "timeoutUnits": "60000",
        "exactOrder": "false",
        "firstMsg": "true",
        "mapPayload": "false",
        "disableComplete": false,
        "x": 1200,
        "y": 800,
        "wires": [["f4c5e7c1.831528"], ["830ebf9c.f1588"]]
    },
    {
        "id": "2830e00c.06bde",
        "type": "inject",
        "z": "ee7b2f38.64383",
        "name": "",
        "topic": "",
        "payload": "",
        "payloadType": "date",
        "repeat": "",
        "crontab": "",
        "once": false,
        "onceDelay": "",
        "x": 300,
        "y": 780,
        "wires": [["4213bd84.2c68b4", "6a032c55.883394", "c47ba83d.c17548", "d2839a03.b24e98"]]
    },
    {
        "id": "7e51b1f.75d755",
        "type": "change",
        "z": "ee7b2f38.64383",
        "name": "Set event_2B",
        "rules": [{ "t": "set", "p": "name", "pt": "msg", "to": "event_2B", "tot": "str" }],
        "action": "",
        "property": "",
        "from": "",
        "to": "",
        "reg": false,
        "x": 760,
        "y": 900,
        "wires": [["4d466044.9e7ba"]]
    },
    {
        "id": "4213bd84.2c68b4",
        "type": "change",
        "z": "ee7b2f38.64383",
        "name": "Set event_2A",
        "rules": [{ "t": "set", "p": "name", "pt": "msg", "to": "event_2A", "tot": "str" }],
        "action": "",
        "property": "",
        "from": "",
        "to": "",
        "reg": false,
        "x": 750,
        "y": 840,
        "wires": [["4d466044.9e7ba"]]
    },
    {
        "id": "c47ba83d.c17548",
        "type": "delay",
        "z": "ee7b2f38.64383",
        "name": "",
        "pauseType": "delay",
        "timeout": "4",
        "timeoutUnits": "seconds",
        "rate": "1",
        "nbRateUnits": "1",
        "rateUnits": "second",
        "randomFirst": "1",
        "randomLast": "5",
        "randomUnits": "seconds",
        "drop": false,
        "x": 560,
        "y": 900,
        "wires": [["7e51b1f.75d755"]]
    },
    {
        "id": "4d466044.9e7ba",
        "type": "join-wait",
        "z": "ee7b2f38.64383",
        "name": "",
        "paths": "[\"event_2A\", \"event_2B\"]",
        "pathsToExpire": "",
        "ignoreUnmatched": false,
        "pathTopic": "name",
        "pathTopicType": "msg",
        "correlationTopic": "",
        "correlationTopicType": "msg",
        "timeout": "5",
        "timeoutUnits": "1000",
        "exactOrder": "false",
        "firstMsg": "true",
        "mapPayload": "true",
        "disableComplete": false,
        "x": 940,
        "y": 860,
        "wires": [["89331b9.e9fbce8"], []]
    },
    {
        "id": "a335f9be.14d698",
        "type": "change",
        "z": "ee7b2f38.64383",
        "name": "Set event_3A",
        "rules": [{ "t": "set", "p": "name", "pt": "msg", "to": "event_3A", "tot": "str" }],
        "action": "",
        "property": "",
        "from": "",
        "to": "",
        "reg": false,
        "x": 950,
        "y": 1040,
        "wires": [["8d4ce0e0.362b7"]]
    },
    {
        "id": "b3d43a9c.4f0558",
        "type": "inject",
        "z": "ee7b2f38.64383",
        "name": "",
        "topic": "",
        "payload": "",
        "payloadType": "date",
        "repeat": "",
        "crontab": "",
        "once": false,
        "onceDelay": "",
        "x": 780,
        "y": 1040,
        "wires": [["a335f9be.14d698"]]
    },
    {
        "id": "830ebf9c.f1588",
        "type": "debug",
        "z": "ee7b2f38.64383",
        "name": "Expired",
        "active": true,
        "tosidebar": true,
        "console": false,
        "tostatus": true,
        "complete": "true",
        "targetType": "full",
        "x": 1360,
        "y": 840,
        "wires": []
    },
    {
        "id": "f4c5e7c1.831528",
        "type": "debug",
        "z": "ee7b2f38.64383",
        "name": "Success",
        "active": true,
        "tosidebar": true,
        "console": false,
        "tostatus": false,
        "complete": "true",
        "targetType": "full",
        "x": 1360,
        "y": 760,
        "wires": []
    },
    {
        "id": "89331b9.e9fbce8",
        "type": "delay",
        "z": "ee7b2f38.64383",
        "name": "",
        "pauseType": "delay",
        "timeout": "10",
        "timeoutUnits": "seconds",
        "rate": "1",
        "nbRateUnits": "1",
        "rateUnits": "second",
        "randomFirst": "1",
        "randomLast": "5",
        "randomUnits": "seconds",
        "drop": false,
        "x": 1000,
        "y": 800,
        "wires": [["8d4ce0e0.362b7"]]
    },
    {
        "id": "d2839a03.b24e98",
        "type": "delay",
        "z": "ee7b2f38.64383",
        "name": "",
        "pauseType": "delay",
        "timeout": "1",
        "timeoutUnits": "seconds",
        "rate": "1",
        "nbRateUnits": "1",
        "rateUnits": "second",
        "randomFirst": "1",
        "randomLast": "5",
        "randomUnits": "seconds",
        "drop": false,
        "x": 560,
        "y": 660,
        "wires": [["c264c765.36e3c8"]]
    },
    {
        "id": "69bf4156.8d7b8",
        "type": "comment",
        "z": "ee7b2f38.64383",
        "name": "Expire all messages with event_3A",
        "info": "",
        "x": 860,
        "y": 1000,
        "wires": []
    }
]
```

</details>

## Example 4: Wait 10 seconds for Event 1 to fire 3 times, followed by Event 3. Must be in this exact order.

-   Shows an example of repeated path names
-   Shows an example of setting multiple paths by a single event

![Example 4](/docs/example4.png?raw=true 'Example 4')

<details><summary>Flow</summary>

```json
[
    {
        "id": "cc9d6391.878ea",
        "type": "debug",
        "z": "d21c3caf.1c4a6",
        "name": "success",
        "active": true,
        "tosidebar": true,
        "console": false,
        "tostatus": false,
        "complete": "true",
        "targetType": "full",
        "statusVal": "",
        "statusType": "auto",
        "x": 800,
        "y": 120,
        "wires": []
    },
    {
        "id": "98108d1f.bc6aa",
        "type": "join-wait",
        "z": "d21c3caf.1c4a6",
        "name": "",
        "paths": "[\"path_1\",\"path_1\",\"path_1\",\"path_3\"]",
        "pathsToExpire": "",
        "useRegex": false,
        "warnUnmatched": false,
        "pathTopic": "paths",
        "pathTopicType": "msg",
        "correlationTopic": "",
        "correlationTopicType": "undefined",
        "timeout": "10",
        "timeoutUnits": "1000",
        "exactOrder": "true",
        "firstMsg": "true",
        "mapPayload": "true",
        "disableComplete": false,
        "x": 600,
        "y": 180,
        "wires": [["cc9d6391.878ea"], ["38e19f0c.ff2a9"]]
    },
    {
        "id": "38e19f0c.ff2a9",
        "type": "debug",
        "z": "d21c3caf.1c4a6",
        "name": "expired",
        "active": true,
        "tosidebar": true,
        "console": false,
        "tostatus": false,
        "complete": "true",
        "targetType": "full",
        "statusVal": "",
        "statusType": "auto",
        "x": 800,
        "y": 260,
        "wires": []
    },
    {
        "id": "9d4f0eed.15eb3",
        "type": "change",
        "z": "d21c3caf.1c4a6",
        "name": "Set path_1 and path_3",
        "rules": [
            { "t": "set", "p": "paths", "pt": "msg", "to": "{\"path_1\": true, \"path_3\":true}", "tot": "json" }
        ],
        "action": "",
        "property": "",
        "from": "",
        "to": "",
        "reg": false,
        "x": 360,
        "y": 260,
        "wires": [["98108d1f.bc6aa"]]
    },
    {
        "id": "c1809b24.8990f8",
        "type": "delay",
        "z": "d21c3caf.1c4a6",
        "name": "",
        "pauseType": "delay",
        "timeout": "1",
        "timeoutUnits": "seconds",
        "rate": "1",
        "nbRateUnits": "1",
        "rateUnits": "second",
        "randomFirst": "1",
        "randomLast": "5",
        "randomUnits": "seconds",
        "drop": false,
        "x": 160,
        "y": 260,
        "wires": [["9d4f0eed.15eb3"]]
    },
    {
        "id": "b69f3131.98969",
        "type": "inject",
        "z": "d21c3caf.1c4a6",
        "name": "",
        "repeat": "",
        "crontab": "",
        "once": false,
        "onceDelay": "",
        "topic": "",
        "payload": "",
        "payloadType": "date",
        "x": 140,
        "y": 120,
        "wires": [["bb0b9bc5.c65ee8", "c1809b24.8990f8", "8969e7ba.e36038"]]
    },
    {
        "id": "bb0b9bc5.c65ee8",
        "type": "change",
        "z": "d21c3caf.1c4a6",
        "name": "Set path_1",
        "rules": [{ "t": "set", "p": "paths", "pt": "msg", "to": "path_1", "tot": "str" }],
        "action": "",
        "property": "",
        "from": "",
        "to": "",
        "reg": false,
        "x": 330,
        "y": 120,
        "wires": [["98108d1f.bc6aa"]]
    },
    {
        "id": "8969e7ba.e36038",
        "type": "change",
        "z": "d21c3caf.1c4a6",
        "name": "Set path_1",
        "rules": [{ "t": "set", "p": "paths", "pt": "msg", "to": "path_1", "tot": "str" }],
        "action": "",
        "property": "",
        "from": "",
        "to": "",
        "reg": false,
        "x": 330,
        "y": 180,
        "wires": [["98108d1f.bc6aa"]]
    }
]
```

</details>

## Example 5: Wait 10 seconds for the exact event order "path_1", "path_2", "path_1", "path_2".

-   Shows an example of repeated path names
-   Shows an example of an unexpected path name being observed. This can be caught by another node, if desired.

![Example 5](/docs/example5.png?raw=true 'Example 5')

<details><summary>Flow</summary>

```json
[
    {
        "id": "cc9d6391.878ea",
        "type": "debug",
        "z": "d21c3caf.1c4a6",
        "name": "success",
        "active": true,
        "tosidebar": true,
        "console": false,
        "tostatus": false,
        "complete": "true",
        "targetType": "full",
        "statusVal": "",
        "statusType": "auto",
        "x": 800,
        "y": 120,
        "wires": []
    },
    {
        "id": "98108d1f.bc6aa",
        "type": "join-wait",
        "z": "d21c3caf.1c4a6",
        "name": "",
        "paths": "[\"path_1\",\"path_2\",\"path_1\",\"path_2\"]",
        "pathsToExpire": "",
        "useRegex": false,
        "warnUnmatched": true,
        "pathTopic": "paths",
        "pathTopicType": "msg",
        "correlationTopic": "",
        "correlationTopicType": "undefined",
        "timeout": "10",
        "timeoutUnits": "1000",
        "exactOrder": "true",
        "firstMsg": "true",
        "mapPayload": "true",
        "disableComplete": false,
        "x": 640,
        "y": 160,
        "wires": [["cc9d6391.878ea"], ["38e19f0c.ff2a9"]]
    },
    {
        "id": "38e19f0c.ff2a9",
        "type": "debug",
        "z": "d21c3caf.1c4a6",
        "name": "expired",
        "active": true,
        "tosidebar": true,
        "console": false,
        "tostatus": false,
        "complete": "true",
        "targetType": "full",
        "statusVal": "",
        "statusType": "auto",
        "x": 800,
        "y": 240,
        "wires": []
    },
    {
        "id": "c1809b24.8990f8",
        "type": "delay",
        "z": "d21c3caf.1c4a6",
        "name": "",
        "pauseType": "delay",
        "timeout": "1",
        "timeoutUnits": "seconds",
        "rate": "1",
        "nbRateUnits": "1",
        "rateUnits": "second",
        "randomFirst": "1",
        "randomLast": "5",
        "randomUnits": "seconds",
        "drop": false,
        "x": 160,
        "y": 200,
        "wires": [["bb0b9bc5.c65ee8", "2f5d90da.fabdf", "77c09e21.8cb11"]]
    },
    {
        "id": "b69f3131.98969",
        "type": "inject",
        "z": "d21c3caf.1c4a6",
        "name": "",
        "repeat": "",
        "crontab": "",
        "once": false,
        "onceDelay": "",
        "topic": "",
        "payload": "",
        "payloadType": "date",
        "x": 140,
        "y": 120,
        "wires": [["bb0b9bc5.c65ee8", "2f5d90da.fabdf", "c1809b24.8990f8"]]
    },
    {
        "id": "bb0b9bc5.c65ee8",
        "type": "change",
        "z": "d21c3caf.1c4a6",
        "name": "Set path_1",
        "rules": [{ "t": "set", "p": "paths", "pt": "msg", "to": "path_1", "tot": "str" }],
        "action": "",
        "property": "",
        "from": "",
        "to": "",
        "reg": false,
        "x": 430,
        "y": 100,
        "wires": [["98108d1f.bc6aa"]]
    },
    {
        "id": "8969e7ba.e36038",
        "type": "change",
        "z": "d21c3caf.1c4a6",
        "name": "Set path_2",
        "rules": [{ "t": "set", "p": "paths", "pt": "msg", "to": "path_2", "tot": "str" }],
        "action": "",
        "property": "",
        "from": "",
        "to": "",
        "reg": false,
        "x": 470,
        "y": 220,
        "wires": [["98108d1f.bc6aa"]]
    },
    {
        "id": "2f5d90da.fabdf",
        "type": "delay",
        "z": "d21c3caf.1c4a6",
        "name": "",
        "pauseType": "delay",
        "timeout": "100",
        "timeoutUnits": "milliseconds",
        "rate": "1",
        "nbRateUnits": "1",
        "rateUnits": "second",
        "randomFirst": "1",
        "randomLast": "5",
        "randomUnits": "seconds",
        "drop": false,
        "x": 430,
        "y": 160,
        "wires": [["8969e7ba.e36038"]]
    },
    {
        "id": "77c09e21.8cb11",
        "type": "change",
        "z": "d21c3caf.1c4a6",
        "name": "Set path_3",
        "rules": [{ "t": "set", "p": "paths", "pt": "msg", "to": "path_3", "tot": "str" }],
        "action": "",
        "property": "",
        "from": "",
        "to": "",
        "reg": false,
        "x": 470,
        "y": 260,
        "wires": [["98108d1f.bc6aa"]]
    }
]
```

</details>

## Example 6: Wait 10 seconds for two "path_1" events and one "path_2" event in any order.

![Example 6](/docs/example6.png?raw=true 'Example 6')

<details><summary>Flow</summary>

```json
[
    {
        "id": "cc9d6391.878ea",
        "type": "debug",
        "z": "d21c3caf.1c4a6",
        "name": "success",
        "active": true,
        "tosidebar": true,
        "console": false,
        "tostatus": false,
        "complete": "true",
        "targetType": "full",
        "statusVal": "",
        "statusType": "auto",
        "x": 800,
        "y": 120,
        "wires": []
    },
    {
        "id": "98108d1f.bc6aa",
        "type": "join-wait",
        "z": "d21c3caf.1c4a6",
        "name": "",
        "paths": "[\"path_1\",\"path_2\",\"path_1\"]",
        "pathsToExpire": "",
        "useRegex": false,
        "warnUnmatched": true,
        "pathTopic": "paths",
        "pathTopicType": "msg",
        "correlationTopic": "",
        "correlationTopicType": "undefined",
        "timeout": "10",
        "timeoutUnits": "1000",
        "exactOrder": "false",
        "firstMsg": "true",
        "mapPayload": "true",
        "disableComplete": false,
        "x": 640,
        "y": 160,
        "wires": [["cc9d6391.878ea"], ["38e19f0c.ff2a9"]]
    },
    {
        "id": "38e19f0c.ff2a9",
        "type": "debug",
        "z": "d21c3caf.1c4a6",
        "name": "expired",
        "active": true,
        "tosidebar": true,
        "console": false,
        "tostatus": false,
        "complete": "true",
        "targetType": "full",
        "statusVal": "",
        "statusType": "auto",
        "x": 800,
        "y": 240,
        "wires": []
    },
    {
        "id": "b69f3131.98969",
        "type": "inject",
        "z": "d21c3caf.1c4a6",
        "name": "",
        "repeat": "",
        "crontab": "",
        "once": false,
        "onceDelay": "",
        "topic": "",
        "payload": "",
        "payloadType": "date",
        "x": 140,
        "y": 180,
        "wires": [["1546292e.21d097", "25f3441b.c9fd9c", "3c1f3edc.6a53c2"]]
    },
    {
        "id": "bb0b9bc5.c65ee8",
        "type": "change",
        "z": "d21c3caf.1c4a6",
        "name": "Set path_1",
        "rules": [{ "t": "set", "p": "paths", "pt": "msg", "to": "path_1", "tot": "str" }],
        "action": "",
        "property": "",
        "from": "",
        "to": "",
        "reg": false,
        "x": 450,
        "y": 140,
        "wires": [["98108d1f.bc6aa"]]
    },
    {
        "id": "8969e7ba.e36038",
        "type": "change",
        "z": "d21c3caf.1c4a6",
        "name": "Set path_1",
        "rules": [{ "t": "set", "p": "paths", "pt": "msg", "to": "path_1", "tot": "str" }],
        "action": "",
        "property": "",
        "from": "",
        "to": "",
        "reg": false,
        "x": 450,
        "y": 180,
        "wires": [["98108d1f.bc6aa"]]
    },
    {
        "id": "77c09e21.8cb11",
        "type": "change",
        "z": "d21c3caf.1c4a6",
        "name": "Set path_2",
        "rules": [{ "t": "set", "p": "paths", "pt": "msg", "to": "path_2", "tot": "str" }],
        "action": "",
        "property": "",
        "from": "",
        "to": "",
        "reg": false,
        "x": 450,
        "y": 220,
        "wires": [["98108d1f.bc6aa"]]
    },
    {
        "id": "25f3441b.c9fd9c",
        "type": "delay",
        "z": "d21c3caf.1c4a6",
        "name": "",
        "pauseType": "random",
        "timeout": "1",
        "timeoutUnits": "seconds",
        "rate": "1",
        "nbRateUnits": "1",
        "rateUnits": "second",
        "randomFirst": "1",
        "randomLast": "25",
        "randomUnits": "milliseconds",
        "drop": false,
        "x": 300,
        "y": 140,
        "wires": [["bb0b9bc5.c65ee8"]]
    },
    {
        "id": "1546292e.21d097",
        "type": "delay",
        "z": "d21c3caf.1c4a6",
        "name": "",
        "pauseType": "random",
        "timeout": "1",
        "timeoutUnits": "seconds",
        "rate": "1",
        "nbRateUnits": "1",
        "rateUnits": "second",
        "randomFirst": "1",
        "randomLast": "25",
        "randomUnits": "milliseconds",
        "drop": false,
        "x": 300,
        "y": 180,
        "wires": [["8969e7ba.e36038"]]
    },
    {
        "id": "3c1f3edc.6a53c2",
        "type": "delay",
        "z": "d21c3caf.1c4a6",
        "name": "",
        "pauseType": "random",
        "timeout": "1",
        "timeoutUnits": "seconds",
        "rate": "1",
        "nbRateUnits": "1",
        "rateUnits": "second",
        "randomFirst": "1",
        "randomLast": "25",
        "randomUnits": "milliseconds",
        "drop": false,
        "x": 300,
        "y": 220,
        "wires": [["77c09e21.8cb11"]]
    }
]
```

</details>

## :question: Get Help

For bug reports and feature requests, open issues. :bug:

## Installation

First of all, install [Node-RED](http://nodered.org/docs/getting-started/installation)

```sh
# Then open the user data directory `~/.node-red` and install the package
$ cd ~/.node-red
$ npm install node-red-contrib-join-wait
```

Or search for `join-wait` in the manage palette menu

## How to contribute

Have an idea? Found a bug? Contributions and pull requests are welcome.

## Support my projects

I try to reply to everyone needing help using these projects. Obviously, this takes time. However, if you get some profit from this or just want to encourage me to continue creating stuff, there are few ways you can do it:

-   Starring and sharing the projects you like :rocket:
-   [![PayPal][badge_paypal]][paypal-donations] **PayPal**— You can make one-time donations via PayPal.
-   **Venmo**— You can make one-time donations via Venmo.
    ![Venmo QR Code](/docs/venmo.png?raw=true 'Venmo QR Code')
-   **Bitcoin**— You can send me Bitcoin at this address: `33sT6xw3tZWAdP2oL4ygbH5TVpVMfk9VW7`

## Credits

-   Thanks to mauriciom75's https://github.com/mauriciom75/node-red-contrib-wait-paths

## MIT License

[badge_paypal]: https://img.shields.io/badge/Donate-PayPal-blue.svg
[paypal-donations]: https://paypal.me/ddcaspi

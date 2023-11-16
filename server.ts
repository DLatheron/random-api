#!/usr/bin/env node
import express from "express";
import nconf from "nconf";

import { randomApiPoller } from "./src/randomApiPoller.js";
import { ApiServer } from "./src/ApiServer.js";

export async function startUp() {
    nconf.argv({
        parseValues: true
    })
        .env()
        .file({ file: "./config.json" })
        .defaults({
            port: 3000,
            randomApiUrl: "https://csrng.net/csrng/csrng.php?min=0&max=100",
            pollingIntervalInMs: 1000,
            maxRetries: 10,
            retryIntervalInMs: 10
        });

    const apiServer = new ApiServer(express(), nconf.get("port"));
    apiServer.start();

    randomApiPoller();
}

startUp();

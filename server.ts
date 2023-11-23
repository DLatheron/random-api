#!/usr/bin/env node
import express from "express";
import nconf from "nconf";

import { ApiPoller } from "./src/ApiPoller.js";
import { ApiServer } from "./src/ApiServer.js";

nconf
    .argv({ parseValues: true })
    .env()
    .file({ file: "./config.json" })
    .defaults({
        // The port the server will listen on.
        port: 3000,

        // Fully qualified URL to poll.
        randomApiUrl: "https://csrng.net/csrng/csrng.php?min=0&max=100",
        // Extended cron syntax with support for seconds.
        cronSchedule: "*/1 * * * * *",

        // The number of milliseconds to wait before retrying a request that has been throttled.
        throttledRetryDelayInMs: 10,
        // The maximum number of times to retry a request that has been throttled.
        maxThrottledRetries: 50,

        // The number of times to retry a request that has errored.
        errorRetries: 10,
        // The number of milliseconds to wait before timing out a request.
        requestTimeoutInMs: 2000
    });
    
export async function startUp() {
    const apiPoller = new ApiPoller({
        randomApiUrl: nconf.get("randomApiUrl"),
        cronSchedule: nconf.get("cronSchedule"),

        throttledRetryDelayInMs: nconf.get("throttledRetryDelayInMs"),
        maxThrottledRetries: nconf.get("maxThrottledRetries"),

        errorRetries: nconf.get("errorRetries"),
        requestTimeoutInMs: nconf.get("requestTimeoutInMs")
    });
    apiPoller.start();

    const apiServer = new ApiServer({
        app: express(), 
        port: nconf.get("port"), 
        calcAverage: () => apiPoller.getAverage(),
        getFrequency: (value) => apiPoller.getFrequency(value)
    });
    apiServer.start();

    async function shutdown(): Promise<never> {
        apiPoller.stop();
        await apiServer.stop();
        process.exit();
    }

    process.on("SIGINT", () => shutdown());
    process.on("SIGTERM", () => shutdown());
}

startUp();

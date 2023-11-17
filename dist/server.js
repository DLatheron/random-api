#!/usr/bin/env node
import express from "express";
import nconf from "nconf";
import { ApiPoller } from "./src/ApiPoller.js";
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
        cronSchedule: "*/1 * * * * *",
        throttledRetryDelayInMs: 10,
        errorRetries: 10,
        requestTimeoutInMs: 500
    });
    const apiPoller = new ApiPoller({
        randomApiUrl: nconf.get("randomApiUrl"),
        cronSchedule: nconf.get("cronSchedule"),
        throttledRetryDelayInMs: nconf.get("throttledRetryDelayInMs"),
        errorRetries: nconf.get("errorRetries"),
        requestTimeoutInMs: nconf.get("requestTimeoutInMs")
    });
    apiPoller.start();
    const apiServer = new ApiServer({
        app: express(),
        port: nconf.get("port"),
        calcAverage: () => apiPoller.getAverage()
    });
    apiServer.start();
    async function shutdown() {
        apiPoller.stop();
        await apiServer.stop();
        process.exit();
    }
    process.on("SIGINT", () => shutdown());
    process.on("SIGTERM", () => shutdown());
}
startUp();

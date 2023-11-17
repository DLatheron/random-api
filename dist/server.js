#!/usr/bin/env node
import express from "express";
import nconf from "nconf";
import { RandomApiPoller } from "./src/randomApiPoller.js";
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
        cronSchedule: "*/1 * * * * *"
    });
    const randomApiPoller = new RandomApiPoller({
        randomApiUrl: nconf.get("randomApiUrl"),
        cronSchedule: nconf.get("cronSchedule")
    });
    randomApiPoller.start();
    const apiServer = new ApiServer(express(), nconf.get("port"), () => randomApiPoller.getAverage());
    apiServer.start();
    async function shutdown() {
        randomApiPoller.stop();
        await apiServer.stop();
        process.exit();
    }
    process.on("SIGINT", () => shutdown());
    process.on("SIGTERM", () => shutdown());
}
startUp();

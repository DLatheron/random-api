import express from "express";
import nconf from "nconf";

import { startUp } from "./server.js";
import { ApiPoller } from "./src/ApiPoller.js";
import { ApiServer } from "./src/ApiServer.js";

jest.mock("express");
jest.mock("./src/ApiPoller");
jest.mock("./src/ApiServer");

describe("startUp", () => {
    beforeEach(() => {
        nconf.use("memory");
    });

    describe("ApiPoller", () => {
        it("should be constructed with a default config", async () => {
            await startUp();

            expect(ApiPoller).toHaveBeenCalledWith({
                randomApiUrl: "https://csrng.net/csrng/csrng.php?min=0&max=100",
                cronSchedule: "*/1 * * * * *",

                throttledRetryDelayInMs: 10,
                maxThrottledRetries: 50,

                errorRetries: 10,
                requestTimeoutInMs: 2000
            });
        });

        it("should be constructed with an overriden config", async () => {
            nconf.set("randomApiUrl", "some-random-api-url");
            nconf.set("cronSchedule", "some-cron-schedule");

            nconf.set("throttledRetryDelayInMs", 456);
            nconf.set("maxThrottledRetries", 1234);

            nconf.set("errorRetries", 789);
            nconf.set("requestTimeoutInMs", 3458);

            await startUp();

            expect(ApiPoller).toHaveBeenCalledWith({
                randomApiUrl: "some-random-api-url",
                cronSchedule: "some-cron-schedule",

                throttledRetryDelayInMs: 456,
                maxThrottledRetries: 1234,

                errorRetries: 789,
                requestTimeoutInMs: 3458
            });
        }); 
        
        it("should be started", async () => {
            await startUp();

            expect(ApiPoller.prototype.start).toHaveBeenCalledTimes(1);
            expect(ApiPoller.prototype.start).toHaveBeenCalledWith();
        });
    });

    describe("ApiServer", () => {
        it("should be constructed with a default config", async () => {
            await startUp();

            expect(ApiServer).toHaveBeenCalledWith({
                app: express(),
                port: 3000,
                calcAverage: expect.any(Function)
            });
        });

        it("should be constructed with an overriden config", async () => {
            nconf.set("port", 1234);

            await startUp();

            expect(ApiServer).toHaveBeenCalledWith({
                app: express(),
                port: 1234,
                calcAverage: expect.any(Function)
            });
        });

        it("should be supplied a calcAverage function which calls the apiPoller's getAverage function", async () => {
            await startUp();

            const calcAverage = (ApiServer as jest.Mock).mock.calls[0][0].calcAverage;
            (ApiPoller.prototype.getAverage as jest.Mock).mockReturnValue(1234);

            const result = calcAverage();

            expect(ApiPoller.prototype.getAverage).toHaveBeenCalledTimes(1);
            expect(ApiPoller.prototype.getAverage).toHaveBeenCalledWith();
            expect(result).toBe(1234);
        });

        it("should be started", async () => {
            await startUp();

            expect(ApiServer.prototype.start).toHaveBeenCalledTimes(1);
            expect(ApiServer.prototype.start).toHaveBeenCalledWith();
        });
    });

    describe("shutdown", () => {
        beforeEach(() => {
            jest.spyOn(process, "exit").mockImplementation();
            jest.spyOn(process, "on").mockImplementation();
        });

        it("should register the shutdown function against the process exit events", async () => {
            await startUp();

            expect(process.on).toHaveBeenCalledTimes(2);
            expect(process.on).toHaveBeenCalledWith("SIGINT", expect.any(Function));
            expect(process.on).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
        });

        it("should shutdown the application when the shutdown function is called", async () => {
            await startUp();

            const shutdown = (process.on as jest.Mock).mock.calls[0][1];
            await shutdown();

            expect(ApiPoller.prototype.stop).toHaveBeenCalledTimes(1);
            expect(ApiPoller.prototype.stop).toHaveBeenCalledWith();

            expect(ApiServer.prototype.stop).toHaveBeenCalledTimes(1);
            expect(ApiServer.prototype.stop).toHaveBeenCalledWith();

            expect(process.exit).toHaveBeenCalledTimes(1);
            expect(process.exit).toHaveBeenCalledWith();
        });
    });
});

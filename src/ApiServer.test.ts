import { Express } from "express";
import { Server } from "http";

import { ApiServer } from "./ApiServer";

jest.mock("http");

describe("startApiServer", () => {
    let apiServer: ApiServer;
    let mockApp: Express;
    let mockServer: Server;

    beforeEach(() => {
        mockServer = {
            close: jest.fn()
        } as unknown as Server;
        mockApp = {
            get: jest.fn(),
            listen: jest.fn().mockImplementation((_port, cb) => {
                cb();
                return mockServer;
            })
        } as unknown as Express;

        jest.spyOn(console, "info").mockImplementation(() => {});
    });

    describe("constructor", () => {
        it("should register a GET /api/v1/random_average route", () => {
            apiServer = new ApiServer(mockApp, 3456);

            expect(mockApp.get).toHaveBeenCalledTimes(1);
            expect(mockApp.get).toHaveBeenCalledWith("/api/v1/random_average", expect.any(Function));
            expect((mockApp.get as jest.Mock).mock.calls[0][1].name).toBe("bound getAverage");
        });
    });

    describe("start", () => {
        beforeEach(() => {
            apiServer = new ApiServer(mockApp, 3456);
        });

        it("should start an http server", async () => {
            await apiServer.start()

            expect(mockApp.listen).toHaveBeenCalledTimes(1);
            expect(mockApp.listen).toHaveBeenCalledWith(3456, expect.any(Function));
        });

        it("should log the port the server is running on", async () => {
            await apiServer.start();

            expect(console.info).toHaveBeenCalledTimes(1);
            expect(console.info).toHaveBeenCalledWith("⚡️ Server running on port 3456");
        });

        it("should return the http server", async () => {
            expect(await apiServer.start()).toBe(mockServer);
        });
    });

    describe("stop", () => {
        beforeEach(async () => {
            apiServer = new ApiServer(mockApp, 3456);
            await apiServer.start();
        });

        it("should close the http server", () => {
            apiServer.stop();

            expect(mockServer.close).toHaveBeenCalledTimes(1);
            expect(mockServer.close).toHaveBeenCalledWith();
        });
    });

    describe("getAverage", () => {
        it.todo("should return the current average");
    });
});

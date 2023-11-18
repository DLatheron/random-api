import { Express, Request, Response } from "express";
import { Server } from "http";

import { ApiServer, ApiServerConfig } from "./ApiServer.js";

jest.mock("http");

describe("ApiServer", () => {
    let apiServer: ApiServer;
    let mockApp: Express;
    let mockServer: Server;
    let apiConfig: ApiServerConfig

    beforeEach(() => {
        mockServer = {
            close: jest.fn().mockImplementation(cb => cb())
        } as unknown as Server;
        mockApp = {
            get: jest.fn(),
            listen: jest.fn().mockImplementation((_port, cb) => {
                cb();
                return mockServer;
            })
        } as unknown as Express;
        apiConfig = {
            app: mockApp,
            port: 3456,
            calcAverage: jest.fn()
        };

        jest.spyOn(console, "info").mockImplementation(() => {});
        jest.spyOn(console, "error").mockImplementation(() => {});
    });

    describe("constructor", () => {
        it("should register a GET /api/v1/random_average route", () => {
            apiServer = new ApiServer(apiConfig);

            expect(mockApp.get).toHaveBeenCalledTimes(1);
            expect(mockApp.get).toHaveBeenCalledWith("/api/v1/random_average", expect.any(Function));
            expect((mockApp.get as jest.Mock).mock.calls[0][1].name).toBe("bound getAverage");
        });
    });

    describe("start", () => {
        beforeEach(() => {
            apiServer = new ApiServer(apiConfig);
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
            apiServer = new ApiServer(apiConfig);
        });

        describe("when the http server is not running", () => {
            beforeEach(() => {
                (mockApp.listen as jest.Mock).mockClear();
                (mockServer.close as jest.Mock).mockClear();
            });

            it("should not close the http server", async () => {
                await apiServer.stop();

                expect(mockServer.close).not.toHaveBeenCalled();
            });

            it("should resolve", async () => {
                await expect(apiServer.stop()).resolves.toBeUndefined();
            });
        });

        describe("when the http server is running", () => {
            beforeEach(async () => {
                await apiServer.start();

                (console.info as jest.Mock).mockClear();
            });

            it("should log that the server is shutting down", async () => {
                await apiServer.stop();

                expect(console.info).toHaveBeenCalledTimes(1);
                expect(console.info).toHaveBeenCalledWith("Shutting down server...");
            });
            
            it("should close the http server", () => {
                apiServer.stop();

                expect(mockServer.close).toHaveBeenCalledTimes(1);
                expect(mockServer.close).toHaveBeenCalledWith(expect.any(Function));
            });

            it("should resolve", async () => {
                await expect(apiServer.stop()).resolves.toBeUndefined();
            });

            it("should set the http server to undefined", async () => {
                await apiServer.stop();

                expect(apiServer["server"]).toBeUndefined();
            });

            describe("when the http server fails to close successfully", () => {
                let expectedError: Error;

                beforeEach(() => {
                    expectedError = new Error("Oh no!");
                    (mockServer.close as jest.Mock).mockImplementationOnce(cb => cb(expectedError));
                });

                it("should log any errors that occur when closing the http server", async () => {
                    await expect(apiServer.stop()).rejects.toThrow(expectedError);

                    expect(console.error).toHaveBeenCalledTimes(1);
                    expect(console.error).toHaveBeenCalledWith(expectedError);
                });

                it("should throw the error", async () => {
                    await expect(apiServer.stop()).rejects.toThrow(expectedError);
                });
            });
        });
    });

    describe("getAverage", () => {
        let request: Request;
        let response: Response;

        beforeEach(async () => {
            request = {} as Request;
            response = {
                send: jest.fn()
            } as unknown as Response;

            apiConfig.calcAverage = jest.fn().mockReturnValue(42);

            apiServer = new ApiServer(apiConfig);
        });
        
        it("should call the calcAverage function", () => {
            apiServer.getAverage(request, response);

            expect(apiConfig.calcAverage).toHaveBeenCalledTimes(1);
            expect(apiConfig.calcAverage).toHaveBeenCalledWith();
        });
        
        it("should return the result of calling the calcAverage function", () => {
            apiServer.getAverage(request, response);

            expect(response.send).toHaveBeenCalledTimes(1);
            expect(response.send).toHaveBeenCalledWith({ average: 42 });
        });
    });
});

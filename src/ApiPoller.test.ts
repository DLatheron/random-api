import dayjs from "dayjs";
import ky, { HTTPError, ResponsePromise } from "ky";
import schedule, { Job } from "node-schedule";

import { ApiPoller } from "./ApiPoller";

jest.mock("node-schedule");

describe("ApiPoller", () => {
    let apiPoller: ApiPoller;

    beforeEach(() => {
        apiPoller = new ApiPoller({
            randomApiUrl: "https://www.random.org/integers",
            cronSchedule: "*/5 * * * * *",

            throttledRetryDelayInMs: 13,
            maxThrottledRetries: 0,

            errorRetries: 3,
            requestTimeoutInMs: 1234
        });
    });

    describe("constructor", () => {
        it("should zero its statistics", () => {
            expect(apiPoller["statistics"].accumulatedTotal).toBe(0);
            expect(apiPoller["statistics"].count).toBe(0);
            expect(apiPoller["statistics"].allRandomNumbers).toStrictEqual([]);
        });
    });

    describe("start", () => {
        beforeEach(() => {
            jest.spyOn(apiPoller, "resetStatistics");
        });

        it("should reset its statistics", () => {
            apiPoller.start();

            expect(apiPoller.resetStatistics).toHaveBeenCalledTimes(1);
            expect(apiPoller.resetStatistics).toHaveBeenCalledWith();
        });

        it("should schedule a job to call the 'pollApi' function with the provided cron schedule", () => {
            apiPoller.start();

            expect(schedule.scheduleJob).toHaveBeenCalledTimes(1);
            expect(schedule.scheduleJob).toHaveBeenCalledWith("*/5 * * * * *", expect.any(Function));
            expect((schedule.scheduleJob as jest.Mock).mock.calls[0][1].name).toBe("bound pollApi");
        });
    });

    describe("stop", () => {
        let job: Job;
        
        beforeEach(() => {
            job = {
                cancel: jest.fn()
            } as unknown as Job;
            
            (schedule.scheduleJob as jest.Mock).mockReturnValue(job);
        });

        it("should cancel the scheduled job", () => {
            apiPoller.start();
            apiPoller.stop();

            expect(job.cancel).toHaveBeenCalledTimes(1);
            expect(job.cancel).toHaveBeenCalledWith();
        });

        it("should not cancel the scheduled job if it hasn't been started", () => {
            apiPoller.stop();

            expect(job.cancel).not.toHaveBeenCalled();
        });
    });

    describe("getAverage", () => {
        beforeEach(() => {
            apiPoller.resetStatistics();
        });

        describe("when no requests have been made", () => {
            it("should return undefined", () => {
                expect(apiPoller.getAverage()).toBeUndefined();
            });
        });

        describe("when requests have been made", () => {
            beforeEach(() => {
                apiPoller["statistics"].accumulatedTotal = 100;
                apiPoller["statistics"].count = 10;
            });

            it("should return the average of the requests", () => {
                expect(apiPoller.getAverage()).toBe(10);
            });
        });
    });

    describe("resetStatistics", () => {
        beforeEach(() => {
            apiPoller["statistics"].accumulatedTotal = 100;
            apiPoller["statistics"].count = 10;
            apiPoller["statistics"].allRandomNumbers = [1, 2, 3];
        });

        it("should zero its statistics", () => {
            apiPoller.resetStatistics();

            expect(apiPoller["statistics"].accumulatedTotal).toBe(0);
            expect(apiPoller["statistics"].count).toBe(0);
            expect(apiPoller["statistics"].allRandomNumbers).toStrictEqual([]);
        });
    });

    describe("countRandomNumber", () => {
        beforeEach(() => {
            apiPoller.resetStatistics();
            
            jest.spyOn(console, "error").mockImplementation(() => {});
        });

        it("should add the random number to the statistics", () => {
            apiPoller["countRandomNumber"](10);

            expect(apiPoller["statistics"].accumulatedTotal).toBe(10);
            expect(apiPoller["statistics"].count).toBe(1);
            expect(apiPoller["statistics"].allRandomNumbers).toStrictEqual([10]);
        });

        it("should log and error if the accumulated total exceeds the maximum safe value of a number", () => {
            apiPoller["statistics"].accumulatedTotal = Number.MAX_SAFE_INTEGER - 1;

            apiPoller["countRandomNumber"](10);

            expect(console.error).toHaveBeenCalledTimes(1);
            expect(console.error).toHaveBeenCalledWith("Accumulated total has exceeded the maximum safe integer value - resetting statistics");
        });
    });

    describe("pollApi", () => {
        beforeEach(() => {
            jest.spyOn(ky, "get").mockReturnValue({ 
                json: jest.fn().mockResolvedValue([{ status: "success", random: 43, min: 0, max: 100 }])
            } as unknown as ResponsePromise);

            jest.spyOn(console, "debug").mockImplementation(() => {});
            jest.spyOn(console, "error").mockImplementation(() => {});
            jest.spyOn(console, "warn").mockImplementation(() => {});
        });

        it("should log that it is polling the API", async () => {
            await apiPoller["pollApi"]();

            expect(console.debug).toHaveBeenCalledTimes(1);
            expect(console.debug).toHaveBeenCalledWith(`${dayjs().format("HH:mm:ss")} Polling https://www.random.org/integers`);
        });

        it("should call the specified API with the provided config options", async () => {
            await apiPoller["pollApi"]();

            expect(ky.get).toHaveBeenCalledTimes(1);
            expect(ky.get).toHaveBeenCalledWith("https://www.random.org/integers", { timeout: 1234, retry: 3 });
        });

        describe("error handling", () => {
            beforeEach(() => {
                // Stop the poller from retrying on error.
                apiPoller["kyOptions"]["retry"] = 0;
            });

            describe("when the API call succeeds - but is an error", () => {
                it("should log an error if the response from the server is unexpectedly empty", async () => {
                    (ky.get as jest.Mock).mockReturnValue({ 
                        json: jest.fn().mockResolvedValue(undefined)
                    } as unknown as ResponsePromise);

                    await apiPoller["pollApi"]();

                    expect(console.error).toHaveBeenCalledTimes(1);
                    expect(console.error).toHaveBeenCalledWith("Unexpected response from server");
                });

                it("should log an error if the response from the server is an error", async () => {
                    (ky.get as jest.Mock).mockReturnValue({ 
                        json: jest.fn().mockResolvedValue([{ status: "error", code: "1", reason: "Something went wrong" }])
                    } as unknown as ResponsePromise);

                    await apiPoller["pollApi"]();

                    expect(console.error).toHaveBeenCalledTimes(1);
                    expect(console.error).toHaveBeenCalledWith("Something went wrong");
                });
            });

            describe("when the API call fails", () => {
                it("should log an error if the response from the is an HTTP error", async () => {
                    const response = {
                        json: jest.fn().mockResolvedValue({ arbitary: "json-content" })
                    } as any;
                    const httpError = new HTTPError(response, {} as any, {} as any );

                    (ky.get as jest.Mock).mockReturnValue({ 
                        json: jest.fn().mockRejectedValue(httpError)
                    } as unknown as ResponsePromise);

                    await apiPoller["pollApi"]();

                    expect(console.error).toHaveBeenCalledTimes(1);
                    expect(console.error).toHaveBeenCalledWith({ arbitary: "json-content" });
                });

                it("should log an error if the response from the server is an error", async () => {
                    (ky.get as jest.Mock).mockReturnValue({ 
                        json: jest.fn().mockRejectedValue(new Error("Something went wrong"))
                    } as unknown as ResponsePromise);

                    await apiPoller["pollApi"]();

                    expect(console.error).toHaveBeenCalledTimes(1);
                    expect(console.error).toHaveBeenCalledWith("Something went wrong");
                });

                it("should log an error if the response from the server is an error", async () => {
                    (ky.get as jest.Mock).mockReturnValue({ 
                        json: jest.fn().mockRejectedValue("Just a string error")
                    } as unknown as ResponsePromise);

                    await apiPoller["pollApi"]();

                    expect(console.error).toHaveBeenCalledTimes(1);
                    expect(console.error).toHaveBeenCalledWith("Just a string error");
                });
            });

            describe("when the API calls succeeds, but indicates that the request was throttled", () => {
                beforeEach(() => {
                    apiPoller["config"]["maxThrottledRetries"] = 1;

                    (ky.get as jest.Mock).mockReturnValue({ 
                        json: jest.fn().mockResolvedValue([{ status: "error", code: "5", reason: "Throttled" }])
                    } as unknown as ResponsePromise);

                    jest.spyOn(global, "setTimeout");
                });

                it("should wait for the specified delay before retrying", async () => {
                    await apiPoller["pollApi"]();

                    expect(setTimeout).toHaveBeenCalledTimes(1);
                    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 13);
                });

                it("should log a warning", async () => {
                    await apiPoller["pollApi"]();

                    expect(console.warn).toHaveBeenCalledTimes(2);
                    expect(console.warn).toHaveBeenNthCalledWith(1, "Less than a second since that last request - retrying... (retry attempt: 1)");
                    expect(console.warn).toHaveBeenNthCalledWith(2, "Max retries exceeded - aborting");
                });

                describe("when there are multiple retries specified", () => {
                    beforeEach(() => {
                        apiPoller["config"]["maxThrottledRetries"] = 3;
                    });

                    it("should retry the specified number of times", async () => {
                        await apiPoller["pollApi"]();

                        expect(ky.get).toHaveBeenCalledTimes(4);

                        expect(setTimeout).toHaveBeenCalledTimes(3);
                        expect(setTimeout).toHaveBeenNthCalledWith(1, expect.any(Function), 13);
                        expect(setTimeout).toHaveBeenNthCalledWith(2, expect.any(Function), 13);
                        expect(setTimeout).toHaveBeenNthCalledWith(3, expect.any(Function), 13);
                    });

                    it("should log a warning for each retry", async () => {
                        await apiPoller["pollApi"]();

                        expect(console.warn).toHaveBeenCalledTimes(4);
                        expect(console.warn).toHaveBeenNthCalledWith(1, "Less than a second since that last request - retrying... (retry attempt: 1)");
                        expect(console.warn).toHaveBeenNthCalledWith(2, "Less than a second since that last request - retrying... (retry attempt: 2)");
                        expect(console.warn).toHaveBeenNthCalledWith(3, "Less than a second since that last request - retrying... (retry attempt: 3)");
                        expect(console.warn).toHaveBeenNthCalledWith(4, "Max retries exceeded - aborting");
                    });
                });
            });
        });
    });
});

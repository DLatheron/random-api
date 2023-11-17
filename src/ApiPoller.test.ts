import ky, { ResponsePromise } from "ky";
import schedule, { Job } from "node-schedule";

import { ApiPoller } from "./ApiPoller";
import dayjs from "dayjs";

jest.mock("node-schedule");

describe("ApiPoller", () => {
    let apiPoller: ApiPoller;

    beforeEach(() => {
        apiPoller = new ApiPoller({
            randomApiUrl: "https://www.random.org/integers",
            cronSchedule: "*/5 * * * * *",

            throttledRetryDelayInMs: 13,
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
        });

        it("should add the random number to the statistics", () => {
            apiPoller["countRandomNumber"](10);

            expect(apiPoller["statistics"].accumulatedTotal).toBe(10);
            expect(apiPoller["statistics"].count).toBe(1);
            expect(apiPoller["statistics"].allRandomNumbers).toStrictEqual([10]);
        });
    });

    describe.only("pollApi", () => {
        beforeEach(() => {
            jest.useFakeTimers();

            jest.spyOn(ky, "get").mockReturnValue({ 
                json: jest.fn().mockResolvedValue([{ status: "success", random: 43, min: 0, max: 100 }])
            } as unknown as ResponsePromise);

            jest.spyOn(console, "debug").mockImplementation(() => {});
            jest.spyOn(console, "error").mockImplementation(() => {});
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
    });
});

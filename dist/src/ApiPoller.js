import dayjs from "dayjs";
import ky, { HTTPError } from "ky";
import schedule from "node-schedule";
function isServerSuccessResponse(response) {
    return response.status === "success";
}
function isServerErrorResponse(response) {
    return response.status === "error";
}
function delay(delayInMs) {
    return new Promise(resolve => setTimeout(resolve, delayInMs));
}
export class ApiPoller {
    constructor(config) {
        this.config = config;
        this.statistics = {
            accumulatedTotal: 0,
            count: 0,
            allRandomNumbers: []
        };
        this.kyOptions = {
            timeout: config.requestTimeoutInMs,
            retry: config.errorRetries
        };
    }
    start() {
        this.resetStatistics();
        this.job = schedule.scheduleJob(this.config.cronSchedule, this.pollApi.bind(this));
    }
    stop() {
        this.job?.cancel();
        this.job = undefined;
    }
    getAverage() {
        return (this.statistics.count === 0)
            ? undefined
            : this.statistics.accumulatedTotal / this.statistics.count;
    }
    resetStatistics() {
        this.statistics.accumulatedTotal = 0;
        this.statistics.count = 0;
        this.statistics.allRandomNumbers = [];
    }
    countRandomNumber(randomNumber) {
        // Storing the random number for unspecified future use.
        this.statistics.allRandomNumbers.push(randomNumber);
        this.statistics.accumulatedTotal += randomNumber;
        this.statistics.count++;
        if (this.statistics.accumulatedTotal >= Number.MAX_SAFE_INTEGER) {
            console.error("Accumulated total has exceeded the maximum safe integer value - resetting statistics");
            this.resetStatistics();
        }
    }
    async pollApi() {
        console.debug(`${dayjs().format("HH:mm:ss")} Polling ${this.config.randomApiUrl}`);
        let retry = 0;
        for (;;) {
            try {
                const json = await ky.get(this.config.randomApiUrl, this.kyOptions).json();
                console.debug(json);
                if (!json || !Array.isArray(json) || !json[0]) {
                    throw new Error("Unexpected response from server");
                }
                const response = json[0];
                if (isServerErrorResponse(response)) {
                    if (response.code === "5") {
                        ++retry;
                        console.warn(`Less than a second since that last request - retrying... (retry attempt: ${retry})`);
                        await delay(this.config.throttledRetryDelayInMs);
                        continue;
                    }
                    throw new Error(response.reason);
                }
                else if (isServerSuccessResponse(response)) {
                    this.countRandomNumber(response.random);
                    return;
                }
            }
            catch (error) {
                if (error instanceof HTTPError) {
                    console.error(await error.response.json());
                }
                else if (error instanceof Error) {
                    console.error(error.message);
                }
                else {
                    console.error(error);
                }
            }
        }
    }
}

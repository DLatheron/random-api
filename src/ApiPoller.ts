import dayjs from "dayjs";
import ky, { HTTPError, Options } from "ky";
import schedule, { Job } from "node-schedule";

export interface ApiPollerConfig {
    randomApiUrl: string;
    cronSchedule: string;

    throttledRetryDelayInMs: number;
    maxThrottledRetries: number;
    errorRetries: number;
    requestTimeoutInMs: number;
}

interface ServerSuccessResponse {
    status: "success";
    random: number;
    min: number;
    max: number;
}

interface ServerErrorResponse {
    status: "error";
    code: string;
    reason: string;
}

type ServerResponse = ServerSuccessResponse | ServerErrorResponse;

function isServerSuccessResponse(response: ServerResponse): response is ServerSuccessResponse {
    return response.status === "success";
}

function isServerErrorResponse(response: ServerResponse): response is ServerErrorResponse {
    return response.status === "error";
}

function delay(delayInMs: number) {
    return new Promise(resolve => setTimeout(resolve, delayInMs));
}

export class ApiPoller {
    private readonly config: ApiPollerConfig;

    private readonly kyOptions: Options;
    private job?: Job;

    private readonly statistics: {
        accumulatedTotal: number;
        count: number;
        allRandomNumbers: number[];
        randomNumberCount: Record<number, number>;
    };

    constructor(config: ApiPollerConfig) {
        this.config = config

        this.statistics = {
            accumulatedTotal: 0,
            count: 0,
            allRandomNumbers: [],
            randomNumberCount: {}
        };

        this.kyOptions = {
            timeout: config.requestTimeoutInMs,
            retry: config.errorRetries 
        }
    }

    start() {
        this.resetStatistics();

        this.job = schedule.scheduleJob(this.config.cronSchedule, this.pollApi.bind(this));
        if (!this.job) {
            throw new Error(`Failed to schedule job, please check the cron schedule: ${this.config.cronSchedule}`);
        }
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

    getFrequency(value: number) {
        return this.statistics.randomNumberCount[value];
    }

    resetStatistics() {
        this.statistics.accumulatedTotal = 0;
        this.statistics.count = 0;
        this.statistics.allRandomNumbers = [];
        this.statistics.randomNumberCount = {};
    }

    private countRandomNumber(randomNumber: number) {
        // Storing the random number for unspecified future use.
        this.statistics.allRandomNumbers.push(randomNumber);

        this.statistics.accumulatedTotal += randomNumber;
        this.statistics.count++;

        this.statistics.randomNumberCount[randomNumber] = (this.statistics.randomNumberCount[randomNumber] ?? 0) + 1;

        if (this.statistics.accumulatedTotal >= Number.MAX_SAFE_INTEGER) {
            console.error("Accumulated total has exceeded the maximum safe integer value - resetting statistics");
            this.resetStatistics();
        }
    }

    private async pollApi() {
        console.debug(`${dayjs().format("HH:mm:ss")} Polling ${this.config.randomApiUrl}`);

        let retry = 0;

        for ( ; ; ) {
            try {
                const json = await ky.get(this.config.randomApiUrl, this.kyOptions).json<ServerResponse[]>()
                if (!json || !Array.isArray(json) || !json[0]) {
                    throw new Error("Unexpected response from server");
                }

                const response = json[0];
                if (isServerErrorResponse(response)) {
                    if (response.code === "5") {
                        retry++;
                        if (retry > this.config.maxThrottledRetries) {
                            console.warn("Max retries exceeded - aborting");
                            break;
                        }

                        console.warn(`Less than a second since that last request - retrying... (retry attempt: ${retry})`);

                        await delay(this.config.throttledRetryDelayInMs);
                    } else {
                        throw new Error(response.reason);
                    }
                } else if (isServerSuccessResponse(response)) {
                    this.countRandomNumber(response.random);
                    return;
                }
            }
            catch (error: unknown) {
                if (error instanceof HTTPError) {
                    console.error(await error.response.json());
                } else if (error instanceof Error) {
                    console.error(error.message);
                } else {
                    console.error(error);
                }
                return;
            }
        }
    }
}

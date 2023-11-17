import dayjs from "dayjs";
import ky from "ky";
import schedule, { Job } from "node-schedule";

export interface RandomApiPollerConfig {
    randomApiUrl: string;
    cronSchedule: string;
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

export class RandomApiPoller {
    private readonly randomApiUrl: string;
    private readonly cronSchedule: string;

    private job?: Job;

    private readonly statistics: {
        accumulatedTotal: number;
        count: number;
    };

    constructor(config: RandomApiPollerConfig) {
        this.randomApiUrl = config.randomApiUrl;
        this.cronSchedule = config.cronSchedule;

        this.statistics = {
            accumulatedTotal: 0,
            count: 0
        };
    }

    start() {
        this.resetStatistics();

        this.job = schedule.scheduleJob(this.cronSchedule, this.pollApi.bind(this));
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
    }

    private countRandomNumber(randomNumber: number) {
        this.statistics.accumulatedTotal += randomNumber;
        this.statistics.count++;

        if (this.statistics.accumulatedTotal >= Number.MAX_SAFE_INTEGER) {
            console.error("Accumulated total has exceeded the maximum safe integer value - resetting statistics");
            this.resetStatistics();
        }
    }

    private pollApi() {
        console.debug(`${dayjs().format("HH:mm:ss")} Polling ${this.randomApiUrl}`);

        ky.get(this.randomApiUrl)
            .json<ServerResponse[]>()
            .then((json) => {
                console.debug(json);

                if (!json || !Array.isArray(json) || !json[0]) {
                    throw new Error("Unexpected response from server");
                }

                const response = json[0];
                if (isServerErrorResponse(response)) {
                    throw new Error(`Server returned error: ${response.reason} with a success code`);
                }

                this.countRandomNumber(response.random);


                console.debug(this.statistics);
            });
    }
}

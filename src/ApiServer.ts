import { Express, Request, Response } from "express";
import { Server } from "http";

export interface ApiServerConfig {
    app: Express;
    port: number;
    calcAverage: () => number | undefined;
    getFrequency: (value: number) => number | undefined;
}

export class ApiServer {
    private readonly config: ApiServerConfig;
    private server?: Server;

    constructor(config: ApiServerConfig) {
        this.config = config;

        this.config.app.get(
            "/api/v1/random_average", 
            this.getAverage.bind(this)
        );

        this.config.app.get(
            "/api/v1/frequency",
            this.getFrequency.bind(this)
        );
    }

    async start() {
        this.server = this.config.app.listen(this.config.port, () => {
            console.info(`⚡️ Server running on port ${this.config.port}`);
        });

        return this.server;
    }

    stop() {
        return new Promise<void>((resolve, reject) => {
            if (!this.server) {
                return resolve();
            }

            console.info("Shutting down server...");
            this.server.close(error => {
                if (error) {
                    console.error(error);
                    return reject(error);
                }

                this.server = undefined;
                resolve();
            });
        });
    }

    getAverage(_req: Request, res: Response) {
        res.send({ average: this.config.calcAverage() });
    }

    getFrequency(req: Request, res: Response) {
        const value = parseInt((req.query as { value: string }).value, 10);

        res.send({ frequency: this.config.getFrequency(value) });
    }
}

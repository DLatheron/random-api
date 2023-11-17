import { Express, Request, Response } from "express";
import { Server } from "http";

export class ApiServer {
    private readonly app: Express;
    private readonly port: number;
    private readonly calcAverage: () => number | undefined;
    private server?: Server;

    constructor(app: Express, port: number, calcAverage: () => number | undefined) {
        this.app = app;
        this.port = port;
        this.calcAverage = calcAverage;

        this.app.get(
            "/api/v1/random_average", 
            this.getAverage.bind(this)
        );
    }

    async start() {
        this.server = this.app.listen(this.port, () => {
            console.info(`⚡️ Server running on port ${this.port}`);
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
        console.log("Request received");
        const average = this.calcAverage();

        res.send({ average });
    }
}

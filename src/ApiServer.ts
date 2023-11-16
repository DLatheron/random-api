import { Express, Request, Response } from "express";
import { Server } from "http";

export class ApiServer {
    private readonly app: Express;
    private readonly port: number;
    private server?: Server;

    constructor(app: Express, port: number) {
        this.app = app;
        this.port = port;

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
        this.server?.close();
        this.server = undefined;
    }

    getAverage(_req: Request, res: Response) {
        res.send({ average: 42 });
    }
}

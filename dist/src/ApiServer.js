export class ApiServer {
    constructor(app, port, calcAverage) {
        this.app = app;
        this.port = port;
        this.calcAverage = calcAverage;
        this.app.get("/api/v1/random_average", this.getAverage.bind(this));
    }
    async start() {
        this.server = this.app.listen(this.port, () => {
            console.info(`⚡️ Server running on port ${this.port}`);
        });
        return this.server;
    }
    stop() {
        return new Promise((resolve, reject) => {
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
    getAverage(_req, res) {
        console.log("Request received");
        const average = this.calcAverage();
        res.send({ average });
    }
}

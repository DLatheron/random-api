export class ApiServer {
    ;
    constructor(config) {
        this.config = config;
        this.config.app.get("/api/v1/random_average", this.getAverage.bind(this));
    }
    async start() {
        this.server = this.config.app.listen(this.config.port, () => {
            console.info(`⚡️ Server running on port ${this.config.port}`);
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
        res.send({ average: this.config.calcAverage() });
    }
}

import dayjs from "dayjs";
import ky from "ky";
import nconf from "nconf";
import schedule from "node-schedule";

export function randomApiPoller() {
    const randomApiUrl = nconf.get("randomApiUrl");

    schedule.scheduleJob("*/1 * * * * *", function() {
        console.log(`${dayjs().format("HH:mm:ss")} Polling ${randomApiUrl}`);

        ky.get(randomApiUrl)
            .json()
            .then((json) => {
                console.log(json);
            });
    });
}

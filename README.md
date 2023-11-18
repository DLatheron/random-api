# random-api

A microservice that retrieves a random number from a REST service, records each returned value and maintains a rolling average that can be retrieved by a call to the service.

## Running the Services

### Preparation

These instructions assume that you have Node installed on your machine and have SSH access configured to GitHub. These instructions assume a modern version of OSX.

```bash
# Install nvm (or other Node Version Manager).
brew install nvm

# Clone to repository to your local machine.
git clone git@github.com:DLatheron/random-api.git

# Alternatively, you can download a zip of repo from GitHub, extract it to a directory called `random-api` and continue.

# Enter the cloned directory.
cd random-api

# Ensure that you have the expected version of Node installed (should also work with other node version managers).
nvm use

# Pull down the packages.
npm ci
```

### Running the Service

The service can be run in two different ways, either:

1. In development mode using `nodemon`
    ```bash
    npm run dev
    ```

1. By building and running (this also runs type checking, linting and unit tests before building):
    ```bash
    npm run checked:build

    ./dist/server.js # The build process should permission this file as executable.
    ```

## Running the Unit Tests

The unit tests can be run with:

```bash
# Single run with coverage.
npm run test

# Or with file watching.
npm run test:watch
```

## Running with Linting

The lint can be run with:

```bash
# Single run.
npm run lint

# Or with file watching.
npm run lint:watch
```

## Running type checking

Verify that there aren't any type script errors with:

```bash
# Single run.
npm run type:check
```

## Design Trade-offs

- **Number overflow**

    With any system that needs to accumulate numeric values there's a two-fold danger that the variable can either overflow (integers & floats) or lose precision (floats). With Javascript all numbers are represented by double-precision floating point values which means that we need to consider overflow and loss of precision. Thankfully, JS defines `Number.MAX_SAFE_INTEGER` which is the highest integer that we can safely represent as 9,007,199,254,740,991 (above this adding integers does not reliably move you to the correct number!). 
    
    Thankfully, this means that accumulating a random number of up to 100, generated every second would take at least (100 * 60 * 60 * 24 * 365.25) 3,155,760,000 years to overflow. However, this would be a danger if you increase the maximum random number retrieved from the API (which can actually be set to `Number.MAX_SAFE_INTEGER`), so I decided to put in a check for the accumulation going >= this value - at which point the system resets its statistics and starts accumulating again.

- **Number storage**

    The specification calls for the received random numbers to be stored in the memory of the process (without persistence). When questioned about the need for this I was told that it was for an unspecified future requirement. Currently, storage of the number is not necessary as I've used an alternative method to record and calculate the rolling average, and storing the number could potentially cause it to exhaust the
    application heap, or if run in kubernetes without sufficient resource limits it could be OOMKilled. 
    
    Given that there is no requirement to persist this storage, and with the default values it will take a long time to run out of memory, I have decided to let the process just run out of memory and be restarted by its caller (as there isn't a perfect solution to handling this in all cases).

## Future Enhancements

- **Integration testing**

    For a production system there would obviously be a need for a set of further integration/sub-system tests that run against the actual service and/or a mock (to allow easy injection of error conditions).

- **Enhanced statistics**

    It would be helpfuly for the service to also record additional statistics for error rates, to allow the fine tuning of config values and to determine the stability of the choosen end-point. This has been left as a future enhancement.

- **Self Monitor**

    Obviously production system need monitor, but a simple enhancement to this app would be self-monitor when and if it misses polling the end-point for a given second. This would be a simple addition and could then log a message which could be picked up by an external monitor system to generate further statistics.
       
## API Documentation

The API is reachable on the path `/api/v1/random_average`

```bash
# When running locally (on the default port).
curl http://localhost:3000/api/v1/random_average

# If you already have something running on port 3000, the default port can be overriden in the `config.json` file.
```

If successful it returns a 200 and a `application/json` payload of:

```json
{"average":50.811196487376506}
```

Where this is the `average`` of all the polled random numbers so far. 

If you call this endpoint *before* the system has polled any random numbers then you get:

```json
{}
```

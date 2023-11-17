# random-api

A microservice that retrieves a random number from a REST service and maitains a rolling average that can be retrieved by a call to the service.


## Running the Services

### Preparation

These instructions assume that you have Node installed on your machine and have SSH access configured to GitHub.

```bash
# Clone to repository to your local machine.
git clone git@github.com:DLatheron/random-api.git

# Move into the directory.
cd random-api

# Ensure that you have the expected version of Node installed (should also work with other node version managers).
nvm use

# Pull down the packages.
npm ci
```

### Running the Service

The service can be run in two different ways, either:

1. In development mode using `nodemon``
  ```bash
  npm run dev
  ```

1. By building and running:
  ```bash
  npm run build
  ./dist/server.js # The build process should permission the files as executable.
  ```

## Running the Unit Tests


## Design Trade-offs

- Number overflow

  Any system that needs to accumulate numeric values there's a two-fold danger that the variable can either overflow (integers & floats) or lose precision (floats). With Javascript all numbers are represented by double-precision floating point values which means that we need to consider overflow and lose of precision. Thankfully, JS defines `Number.MAX_SAFE_INTEGER` which is the highest number that we can safely represent as 9,007,199,254,740,991. 
  
  Thankfully, this means that accumulating a random number of up to 100, generated every second would take at least (100 * 60 * 60 * 24 * 365.25) 3,155,760,000 years to overflow - so I've chosen to ignore lost of precision or overflow.

  >***NOTE:** If you choose to change the configuration of this application from the defaults of a random number between 0 and 100, at a rate of once per second then you run the risk of hitting this overflow condition considerably more quickly.*

- Number storage

  The specification calls for the received random numbers to be stored in the memory of the process (without persistence). When questioned about the need for this I was told that it was for an unspecified future requirement. Currently storage of the number is not necessary as I've used an alternative method to record and calculate the rolling average, and storing the number could potentially cause it to exhaust the
  application heap, or if run in kubernetes without sufficient resource limits could be OOMKilled. 
  
  Given that there is no requirement to persist this storage, and with the default values it will take a long time to run out of memory, I have decided to let the process just run out of memory and be restarted be its caller (as there isn't a perfect solution to handling this in all cases).

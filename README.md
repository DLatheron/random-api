# random-api

A microservice that retrieves a random number from a REST service and maitains a rolling average that can be retrieved by a call to the service.


## Running the Services


## Running the Unit Tests


## Design Trade-offs

- Number overflow

  Any system that needs to accumulate numeric values there's a two-fold danger that the variable can either overflow (integers & floats) or lose precision (floats). With Javascript all numbers are represented by double-precision floating point values which means that we need to consider overflow and lose of precision. Thankfully, JS defines `Number.MAX_SAFE_INTEGER` which is the highest number that we can safely represent as 9,007,199,254,740,991. 
  
  Thankfully, this means that accumulating a random number of up to 100, generated every second would take at least (100 * 60 * 60 * 24 * 365.25) 3,155,760,000 years to overflow - so I've chosen to ignore lost of precision or overflow.

  >***NOTE:** If you choose to change the configuration of this application from the defaults of a random number between 0 and 100, at a rate of once per second then you run the risk of hitting this overflow condition considerably more quickly.*


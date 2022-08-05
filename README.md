## What is it?

Trying to find the fastest way to send ordered collections across the worker boundary.  

Benchmarks of ByteColumn vs Array vs JSON stringified data across worker boundary using postmessage.

Data structures are subject to the following requirements:
- types within the collection can be mixed
- collections are large, O(500000) items
- collections have fast (i.e. O(1)) index access
- collections have fast (i.e. O(1)) update

### Usage

    yarn install
    yarn start
    
Navigate to localhost:8090 on your favourite browser and open the developer console.


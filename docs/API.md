## Classes

<dl>
<dt><a href="#PipelineState">PipelineState</a></dt>
<dd></dd>
<dt><a href="#PipelineRequest">PipelineRequest</a></dt>
<dd></dd>
<dt><a href="#PipelineResponse">PipelineResponse</a></dt>
<dd></dd>
<dt><a href="#PipelineState">PipelineState</a></dt>
<dd></dd>
</dl>

## Functions

<dl>
<dt><a href="#searchParamsToObject">searchParamsToObject(searchParams)</a> ⇒ <code>Object</code></dt>
<dd><p>Converts URLSearchParams to an object</p>
</dd>
<dt><a href="#extractBodyData">extractBodyData(request)</a> ⇒ <code>Object</code></dt>
<dd><p>Extracts and parses the body data from the request</p>
</dd>
<dt><a href="#formsPipe">formsPipe(state, request)</a> ⇒ <code><a href="#PipelineResponse">Promise.&lt;PipelineResponse&gt;</a></code></dt>
<dd><p>Handle a pipeline POST request.
At this point POST&#39;s only apply to json files that are backed by a workbook.</p>
</dd>
<dt><a href="#htmlPipe">htmlPipe(state, req)</a> ⇒ <code><a href="#PipelineResponse">PipelineResponse</a></code></dt>
<dd><p>Runs the default pipeline and returns the response.</p>
</dd>
<dt><a href="#jsonPipe">jsonPipe(state, req)</a> ⇒ <code><a href="#PipelineResponse">PipelineResponse</a></code></dt>
<dd><p>Runs the default pipeline and returns the response.</p>
</dd>
<dt><a href="#optionsPipe">optionsPipe(state, request)</a> ⇒ <code>Response</code></dt>
<dd><p>Handles options requests</p>
</dd>
</dl>

<a name="PipelineState"></a>

## PipelineState
**Kind**: global class  

* [PipelineState](#PipelineState)
    * [new PipelineState()](#new_PipelineState_new)
    * [new PipelineState()](#new_PipelineState_new)
    * [.PipelineState](#PipelineState+PipelineState)
        * [new exports.PipelineState(opts)](#new_PipelineState+PipelineState_new)

<a name="new_PipelineState_new"></a>

### new PipelineState()
State of the pipeline

<a name="new_PipelineState_new"></a>

### new PipelineState()
State of the pipeline

<a name="PipelineState+PipelineState"></a>

### pipelineState.PipelineState
**Kind**: instance class of [<code>PipelineState</code>](#PipelineState)  
<a name="new_PipelineState+PipelineState_new"></a>

#### new exports.PipelineState(opts)
Creates the pipeline state


| Param | Type |
| --- | --- |
| opts | <code>PipelineOptions</code> | 

<a name="PipelineRequest"></a>

## PipelineRequest
**Kind**: global class  

* [PipelineRequest](#PipelineRequest)
    * [new PipelineRequest()](#new_PipelineRequest_new)
    * [.PipelineRequest](#PipelineRequest+PipelineRequest)
        * [new exports.PipelineRequest(url, [init])](#new_PipelineRequest+PipelineRequest_new)

<a name="new_PipelineRequest_new"></a>

### new PipelineRequest()
Request of a pipeline

<a name="PipelineRequest+PipelineRequest"></a>

### pipelineRequest.PipelineRequest
**Kind**: instance class of [<code>PipelineRequest</code>](#PipelineRequest)  
<a name="new_PipelineRequest+PipelineRequest_new"></a>

#### new exports.PipelineRequest(url, [init])
Creates the pipeline request


| Param | Type |
| --- | --- |
| url | <code>URL</code> \| <code>string</code> | 
| [init] | <code>PipelineRequestInit</code> | 

<a name="PipelineResponse"></a>

## PipelineResponse
**Kind**: global class  

* [PipelineResponse](#PipelineResponse)
    * [new PipelineResponse()](#new_PipelineResponse_new)
    * [.PipelineResponse](#PipelineResponse+PipelineResponse)
        * [new exports.PipelineResponse()](#new_PipelineResponse+PipelineResponse_new)
    * [.json()](#PipelineResponse+json) ⇒ <code>object</code>

<a name="new_PipelineResponse_new"></a>

### new PipelineResponse()
Response of a pipeline

<a name="PipelineResponse+PipelineResponse"></a>

### pipelineResponse.PipelineResponse
**Kind**: instance class of [<code>PipelineResponse</code>](#PipelineResponse)  
<a name="new_PipelineResponse+PipelineResponse_new"></a>

#### new exports.PipelineResponse()
Creates the pipeline response

<a name="PipelineResponse+json"></a>

### pipelineResponse.json() ⇒ <code>object</code>
Returns the json parsed object of `this.body`.

**Kind**: instance method of [<code>PipelineResponse</code>](#PipelineResponse)  
<a name="PipelineState"></a>

## PipelineState
**Kind**: global class  

* [PipelineState](#PipelineState)
    * [new PipelineState()](#new_PipelineState_new)
    * [new PipelineState()](#new_PipelineState_new)
    * [.PipelineState](#PipelineState+PipelineState)
        * [new exports.PipelineState(opts)](#new_PipelineState+PipelineState_new)

<a name="new_PipelineState_new"></a>

### new PipelineState()
State of the pipeline

<a name="new_PipelineState_new"></a>

### new PipelineState()
State of the pipeline

<a name="PipelineState+PipelineState"></a>

### pipelineState.PipelineState
**Kind**: instance class of [<code>PipelineState</code>](#PipelineState)  
<a name="new_PipelineState+PipelineState_new"></a>

#### new exports.PipelineState(opts)
Creates the pipeline state


| Param | Type |
| --- | --- |
| opts | <code>PipelineOptions</code> | 

<a name="searchParamsToObject"></a>

## searchParamsToObject(searchParams) ⇒ <code>Object</code>
Converts URLSearchParams to an object

**Kind**: global function  
**Returns**: <code>Object</code> - The converted object  

| Param | Type | Description |
| --- | --- | --- |
| searchParams | <code>URLSearchParams</code> | the search params object |

<a name="extractBodyData"></a>

## extractBodyData(request) ⇒ <code>Object</code>
Extracts and parses the body data from the request

**Kind**: global function  
**Returns**: <code>Object</code> - The body data  
**Throws**:

- <code>Error</code> If an error occurs parsing the body


| Param | Type | Description |
| --- | --- | --- |
| request | [<code>PipelineRequest</code>](#PipelineRequest) | the request object (see fetch api) |

<a name="formsPipe"></a>

## formsPipe(state, request) ⇒ [<code>Promise.&lt;PipelineResponse&gt;</code>](#PipelineResponse)
Handle a pipeline POST request.
At this point POST's only apply to json files that are backed by a workbook.

**Kind**: global function  
**Returns**: [<code>Promise.&lt;PipelineResponse&gt;</code>](#PipelineResponse) - a response  

| Param | Type | Description |
| --- | --- | --- |
| state | [<code>PipelineState</code>](#PipelineState) | pipeline options |
| request | [<code>PipelineRequest</code>](#PipelineRequest) |  |

<a name="htmlPipe"></a>

## htmlPipe(state, req) ⇒ [<code>PipelineResponse</code>](#PipelineResponse)
Runs the default pipeline and returns the response.

**Kind**: global function  

| Param | Type |
| --- | --- |
| state | [<code>PipelineState</code>](#PipelineState) | 
| req | [<code>PipelineRequest</code>](#PipelineRequest) | 

<a name="htmlPipe..res"></a>

### htmlPipe~res : [<code>PipelineResponse</code>](#PipelineResponse)
**Kind**: inner constant of [<code>htmlPipe</code>](#htmlPipe)  
<a name="jsonPipe"></a>

## jsonPipe(state, req) ⇒ [<code>PipelineResponse</code>](#PipelineResponse)
Runs the default pipeline and returns the response.

**Kind**: global function  

| Param | Type |
| --- | --- |
| state | [<code>PipelineState</code>](#PipelineState) | 
| req | [<code>PipelineRequest</code>](#PipelineRequest) | 

<a name="optionsPipe"></a>

## optionsPipe(state, request) ⇒ <code>Response</code>
Handles options requests

**Kind**: global function  
**Returns**: <code>Response</code> - a response  

| Param | Type | Description |
| --- | --- | --- |
| state | [<code>PipelineState</code>](#PipelineState) | pipeline options |
| request | [<code>PipelineRequest</code>](#PipelineRequest) |  |


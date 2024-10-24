# About the PACT API Testbed

The [PACT](https://carbon-transparency.org) Methodology and Network by [WBCSD](https://wbcsd.org) defines a way to  calculate and exchange product carbon footprints between companies in supply chains. The data model and API for this data exchange (the PACT Network) are described in the [PACT Technical Specifications](https://github.com/wbcsd/data-exchange-protocol)

Software solutions implementing these specs should be able to  exchange data peer-to-peer. However, by its nature, the footprint data will differ between companies and industries. Also, software solution providers have certain amount of freedom in choosing what parts of the specification to implement.

Therefore, in order to demonstrate that a software implementation is of a certain standard, application vendors conduct a mutual conformance approval process by testing each other, and publish the results in the PACT web site. This tool was built by Takuro Okada to facilitate and automate a large part of this process.

## PACT Adoption

Per the PACT Network Contribution Policy this tool has been adopted in October 2024 by the PACT community and will now be maintained on the WBCSD GitHub.


## Status: Open BETA

PACT aims to use the API Testbed as the official conformance testing tool beginning of 2025. 
We strongly recommend using this tool right now as an aid in verifying PACT conformance.


## Requirements

* Node.js 18.0 later

If Node.js is not installed on your system, see [here](https://nodejs.org/en/learn/getting-started/how-to-install-nodejs).

The test tool will make calls TO the API implementation to be tested, but will also expect incoming calls FROM the implementation. Please make sure any firewall settings accomodate for that. 

## Test Settings

The Tech-Spec-implemented application under test can be connected to via HTTPS. Its endpoints, authentication information, etc. are described in the following YAML.

```yaml
version: "2.2.0"
authContextPath: https://example.com
userName: USER_NAME
password: PASSWORD
dataContextPath: https://example.com
filterSupport: true
limitSupport: true
eventsSupport: true
log: stdout
stubContextPath: http://localhost:3000
stubData:
  companyIds:
    - urn:uuid:38503239-8214-43c6-bc4e-3580a6def72b
```

### Setting details

|Key|Setting contents|
|--|--|
|version|The version of the PACT Tech Spec to test against.|
|url|URL to a custom OpenAPI schema, if no version is specified. Can be a `http(s)://` or local `file://` resource.|
|authContextPath|Context path of Action Authenticate. Usually, this context path plus `/auth/token` becomes the endpoint. If OpenID Connect Discovery is supported, this context path plus `/.well-known/openid-configuration` is accessed to determine the authentication method.|
|userName|Username to use in Action Authenticate.|
|password|Password to use in Action Authenticate.|
|dataContextPath|Context path for Action ListFootprints, Action GetFootprint, and Action Events. In Tech Spec ver 2, this context path with `/2/footprints` appended will be the endpoint.|
|filterSupport|Set to `true` if the application under test implements the `$filter` request parameter in Action ListFootprints.|
|limitSupport|Set to `true` if the application under test implements the `limit` request parameter in Action ListFootprints.|
|eventsSupport|Set to `true` if the application under test implements Action Events.|
|log|Destination for output of test results. If `stdout` is selected, the result will be displayed in the standard output. If `file` is selected, the result will be output to the current directory as `result.log`.|
|userAgent|Set if UserAgent is required in the HTTP header of the request.|
|stubContextPath|Action Events requires two-way communication. Setting the context path here will start the HTTP server with the configured protocol and port. The application under test should be able to respond to this context path when responding to requests.|
|stubData/*|If you want to set a fixed value for ProductFootprint when responding to an Action Events request, specify the ProductFootprint property under `stubData`.|
|keepStub|If set to `true`, the stub server will not terminate when the test case ends. This can be used when sending Action Events from the application under test and verifying the request data.|


## Test

To run this tool, use npx.

If you want to install it in the current directory beforehand, run the following command. (if it is not installed, npx will ask you if you want to install it.)

```sh
npm install @wbcsd/pact-api-testbed
```

Set the YAML file created in [Test Settings](#test-settings) to the setting argument as shown below and execute it.

```sh
npx @wbcsd/pact-api-testbed --setting test.yaml
```


## License

[MIT](LICENSE)


## Developers

[Takuro Okada](mailto:mill6.plat6aux@gmail.com)


---

&copy; Takuro Okada
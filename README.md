# Pathfinder TESTBED

The Pathfinder Framework is proposed by WBCSD/PACT and defines the methodology for accounting carbon footprints. A carbon footprint can be categorized into those related to the company and those dependent on other companies, and if the applications used by the company and other companies implement a common interface, a carbon footprint calculation dependent on other companies can be made more efficient. Specifications for PCF Data Exchange (Tech Spec) defines this interface.

Applications implementing the Tech Spec generally exchange data peer-to-peer, but differences in implementation levels can prevent successful data exchange. Therefore, in order to demonstrate that each application is of a certain standard, application vendors conduct a mutual conformance approval process by testing each other, and publish the results in the PACT web site.

However, since the testing process is not defined in detail in the above mutual approval process, and each vendor conducts testing from their own perspective, there is still variation in the level of implementation. In order to make this situation more rigorous to Tech Spec, I have created a testing tool. With this tool, certain tests can be performed automatically.

**⚠️This software is not WBCSD/PACT approved. Please note that passing a test does not imply any kind of approval.**


## Test Settings

The Pathfinder-implemented application under test can be connected to via HTTPS. Its endpoints, authentication information, etc. are described in the following YAML.

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
|version|The version of the Tech Spec that the application under test implements.|
|authContextPath|Context path of Action Authenticate. Usually, this context path plus `/auth/token` becomes the endpoint. If OpenID Connect Discovery is supported, this context path plus `/.well-known/openid-configuration` is accessed to determine the authentication method.|
|userName|Username to use in Action Authenticate.|
|password|Password to use in Action Authenticate.|
|dataContextPath|Context path for Action ListFootprints, Action GetFootprint, and Action Events. In Tech Spec ver 2, this context path with `/2/footprints` appended will be the endpoint.|
|filterSupport|Set to true if the application under test implements the `$filter` request parameter in Action ListFootprints.|
|limitSupport|Set to true if the application under test implements the `limit` request parameter in Action ListFootprints.|
|eventsSupport|Set to true if the application under test implements Action Events.|
|log|Destination for output of test results. If `stdout` is selected, the result will be displayed in the standard output. If `file` is selected, the result will be output to the current directory as `result.log`.|
|stubContextPath|Action Events requires two-way communication. Setting the context path here will start the HTTP server with the configured protocol and port. The application under test should be able to respond to this context path when responding to requests.|
|stubData/*|If you want to set a fixed value for ProductFootprint when responding to an Action Events request, specify the ProductFootprint property under `stubData`.|


## Test

Set the YAML file created in [Test Settings](#test-settings) to the setting argument as shown below and execute it.

```sh
npx @mill6-plat6aux/pathfinder-testbed --setting test.yaml
```


## License

[MIT](LICENSE)


## Developers

[Takuro Okada](mailto:mill6.plat6aux@gmail.com)


---

&copy; Takuro Okada
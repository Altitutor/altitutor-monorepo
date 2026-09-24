# Separate admin agent reporting from operational writes

The admin MCP supports changing business questions through discoverable approved
datasets and restricted read-only SQL, while operational mutations use explicit
business actions attributed to the acting administrator. A fixed catalogue of
report-specific tools would couple changing analytical methods to deployments;
general developer database access would grant authority beyond those business
tasks. Dataset meanings and relationships remain documented, and database and
execution permissions enforce reporting restrictions independently of the agent.

Analytical methods and recurring instructions belong to the calling agent. The MCP
does not encode named onboarding, retention or weekly-review workflows. External
systems initially retain their own interfaces, and scheduling mutations and outgoing
communications remain outside the initial admin MCP scope.

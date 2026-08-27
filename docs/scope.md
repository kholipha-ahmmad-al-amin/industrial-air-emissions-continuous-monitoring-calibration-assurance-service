# Service Scope

## Purpose

This service records and controls calibration-assurance decisions for continuous emissions monitoring systems. It provides a focused workflow boundary for an industrial environmental management platform, environmental data historian, or compliance evidence repository.

## In Scope

| Capability | Description |
| --- | --- |
| Reading registration | Records a unique monitoring point and analyzer pair with traceable reference evidence. |
| Deviation classification | Calculates calibration risk from reference deviation and allowable tolerance. |
| Controlled lifecycle | Requires a defined sequence from reading registration to record closure. |
| Separation of duties | Restricts every action to an accountable operational role. |
| Evidence retention | Stores summaries and evidence references with all lifecycle actions. |
| Replay prevention | Rejects any previously consumed mutation request identifier. |
| Atomic persistence | Replaces the persisted JSON snapshot through a temporary-file rename. |
| LAN operation | Binds to all host interfaces for approved industrial network deployment. |

## Out of Scope

The service does not directly control stack analyzers, calculate emissions mass rates, submit statutory reports, issue regulatory permits, or replace authorized environmental decisions. Those responsibilities remain with the approved facility systems and personnel.

## API Boundary

The API includes health, record creation, record retrieval, and named lifecycle actions. Mutations require `x-actor-id`, `x-actor-role`, and a unique `x-request-id`. Unknown payload fields are rejected to maintain a precise integration boundary.

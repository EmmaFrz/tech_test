import { describe, expect, it } from 'vitest';

import { makeNode } from '@/test/factories';

import {
  decodeServerMessage,
  isNodeTelemetry,
  isServerMessage,
  TelemetryParseError,
} from './guards';

describe('isNodeTelemetry', () => {
  it('accepts a well-formed node', () => {
    expect(isNodeTelemetry(makeNode())).toBe(true);
  });

  it.each([
    ['a missing node ID', { ...makeNode(), nodeId: undefined }],
    ['an empty node ID', makeNode({ nodeId: '' })],
    ['an unknown status', { ...makeNode(), status: 'DEGRADED' }],
    ['a CPU load above 100', makeNode({ cpuLoad: 101 })],
    ['a negative memory usage', makeNode({ memoryUsage: -1 })],
    ['a negative latency', makeNode({ latencyMs: -5 })],
    ['a non-finite latency', makeNode({ latencyMs: Number.POSITIVE_INFINITY })],
    ['a string timestamp', { ...makeNode(), timestamp: '2026-01-01' }],
    ['null', null],
    ['a number', 42],
  ])('rejects %s', (_, value) => {
    expect(isNodeTelemetry(value)).toBe(false);
  });
});

describe('isServerMessage', () => {
  it('accepts snapshot, delta and heartbeat messages', () => {
    expect(isServerMessage({ type: 'snapshot', seq: 1, nodes: [makeNode()] })).toBe(true);
    expect(isServerMessage({ type: 'delta', seq: 2, updates: [makeNode()] })).toBe(true);
    expect(isServerMessage({ type: 'heartbeat', seq: 3, serverTime: 1_700_000_000_000 })).toBe(
      true,
    );
  });

  it.each([
    ['an unknown type', { type: 'ping', seq: 1 }],
    ['a missing sequence number', { type: 'heartbeat', serverTime: 1 }],
    ['a fractional sequence number', { type: 'heartbeat', seq: 1.5, serverTime: 1 }],
    ['a snapshot without nodes', { type: 'snapshot', seq: 1 }],
    ['a delta with an invalid node', { type: 'delta', seq: 1, updates: [{ nodeId: 'x' }] }],
    ['a heartbeat without a server time', { type: 'heartbeat', seq: 1 }],
    ['an array', []],
    ['null', null],
  ])('rejects %s', (_, value) => {
    expect(isServerMessage(value)).toBe(false);
  });
});

describe('decodeServerMessage', () => {
  it('parses a valid JSON payload', () => {
    const message = { type: 'heartbeat', seq: 7, serverTime: 123 };

    expect(decodeServerMessage(JSON.stringify(message))).toEqual(message);
  });

  it('rejects non-text payloads', () => {
    expect(() => decodeServerMessage(new ArrayBuffer(4))).toThrow(TelemetryParseError);
  });

  it('wraps JSON syntax errors keeping the original cause', () => {
    try {
      decodeServerMessage('{not json');
      expect.unreachable('decodeServerMessage should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(TelemetryParseError);
      expect(error instanceof Error ? error.cause : undefined).toBeInstanceOf(SyntaxError);
    }
  });

  it('rejects JSON that does not follow the protocol', () => {
    expect(() => decodeServerMessage('{"type":"delta","seq":1}')).toThrow(
      'payload does not match the protocol',
    );
  });
});

import { describe, expect, it } from 'vitest';

import { formatUtcTime } from '@/domain/format';
import { makeNode, TEST_TIMESTAMP } from '@/test/factories';

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
    ['a timestamp beyond what a Date can hold', makeNode({ timestamp: 1e20 })],
    ['a timestamp after year 9999', makeNode({ timestamp: Date.UTC(10_000, 0, 1) })],
    ['a timestamp before 1970', makeNode({ timestamp: -1 })],
    ['a hugely negative timestamp', makeNode({ timestamp: -1e20 })],
    ['a non-finite timestamp', makeNode({ timestamp: Number.NaN })],
    ['null', null],
    ['a number', 42],
  ])('rejects %s', (_, value) => {
    expect(isNodeTelemetry(value)).toBe(false);
  });

  it.each([
    ['the Unix epoch', 0],
    ['a current server time', TEST_TIMESTAMP],
    ['the last millisecond of year 9999', Date.UTC(9999, 11, 31, 23, 59, 59, 999)],
  ])('accepts %s as a timestamp, which the grid can format', (_, timestamp) => {
    const node = makeNode({ timestamp });

    expect(isNodeTelemetry(node)).toBe(true);
    expect(formatUtcTime(node.timestamp)).toMatch(/^\d{2}:\d{2}:\d{2}$/);
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
    ['a heartbeat from beyond year 9999', { type: 'heartbeat', seq: 1, serverTime: 1e100 }],
    ['a heartbeat before 1970', { type: 'heartbeat', seq: 1, serverTime: -5 }],
    [
      'a delta with an unformattable timestamp',
      { type: 'delta', seq: 1, updates: [makeNode({ timestamp: 1e20 })] },
    ],
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

import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { InterviewRound, InterviewStationAttempt } from "@altitutor/shared";
import { sendInterviewCommand } from "../../api/interviews";
import { useInterviewQuestionTiming } from "../use-interview-question-timing";

jest.mock("../../api/interviews", () => ({ sendInterviewCommand: jest.fn() }));
jest.mock("../use-interviews", () => ({ interviewKeys: { round: (id: string) => ["interviews", "round", id] } }));
const send = jest.mocked(sendInterviewCommand);
const round = { id: "round", phase: "questions", pausedAt: null } as InterviewRound;
const attempt = { id: "attempt", selectedQuestionId: "q1" } as InterviewStationAttempt;
function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}>{children}</QueryClientProvider>;
}
beforeEach(() => send.mockReset());

test("quick question revisits are saved in navigation order, without assessment commands", async () => {
  let finish: (() => void) | undefined;
  send.mockImplementationOnce(() => new Promise(resolve => { finish = () => resolve({id:"round",version:1}); }));
  send.mockResolvedValue({id:"round",version:1});
  const {result} = renderHook(() => useInterviewQuestionTiming(round,attempt),{wrapper});
  act(() => { result.current.onQuestionSelected("q2"); result.current.onQuestionSelected("q1"); });
  expect(send).toHaveBeenCalledTimes(1);
  await act(async () => finish?.());
  await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
  expect(send.mock.calls.map(([command]) => command)).toEqual([
    expect.objectContaining({type:"selectQuestion",questionId:"q2",attemptId:"attempt"}),
    expect.objectContaining({type:"selectQuestion",questionId:"q1",attemptId:"attempt"}),
  ]);
});

test("an unknown network outcome retries the same command identity", async () => {
  send.mockRejectedValueOnce(new Error("Offline")).mockResolvedValue({id:"round",version:1});
  const {result} = renderHook(() => useInterviewQuestionTiming(round,attempt),{wrapper});
  act(() => result.current.onQuestionSelected("q2"));
  await waitFor(() => expect(result.current.timingError).toBe("Offline"));
  const first = send.mock.calls[0][0];
  await act(async () => result.current.retryTiming());
  expect(send.mock.calls[1][0]).toEqual(first);
  expect(result.current.timingError).toBeNull();
});

test("a group skip discards late rejected question navigation without a retry error", async () => {
  let rejectSelection: ((error: Error) => void) | undefined;
  send.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectSelection = reject; }));
  const { result, rerender } = renderHook(
    ({ value }) => useInterviewQuestionTiming(value, attempt),
    { wrapper, initialProps: { value: round } },
  );
  act(() => {
    result.current.onQuestionSelected("q2");
    result.current.onQuestionSelected("q3");
  });
  rerender({ value: { ...round, phase: "feedback" } });
  await act(async () => rejectSelection?.(Object.assign(
    new Error("Questions are not active for this station"),
    { status: 400 },
  )));

  expect(result.current.timingError).toBeNull();
  await act(async () => result.current.retryTiming());
  expect(send).toHaveBeenCalledTimes(1);
});

test("a group skip clears an earlier timing rejection once feedback is rendered", async () => {
  const message = "Questions are not active for this station";
  send.mockRejectedValueOnce(Object.assign(new Error(message), { status: 400 }));
  const { result, rerender } = renderHook(
    ({ value }) => useInterviewQuestionTiming(value, attempt),
    { wrapper, initialProps: { value: round } },
  );
  act(() => result.current.onQuestionSelected("q2"));
  await waitFor(() => expect(result.current.timingError).toBe(message));

  rerender({ value: { ...round, phase: "feedback" } });
  expect(result.current.timingError).toBeNull();
  await act(async () => result.current.retryTiming());
  expect(send).toHaveBeenCalledTimes(1);
});

test("paused and non-question phases cannot extend answering time", () => {
  const {result} = renderHook(() => useInterviewQuestionTiming({...round,pausedAt:"2026-11-05T10:00:00Z"},attempt),{wrapper});
  act(() => result.current.onQuestionSelected("q2"));
  expect(send).not.toHaveBeenCalled();
});


test("a revisit after acknowledgement is retained while the round refetch is delayed", async () => {
  send.mockResolvedValue({id:"round",version:1});
  const {result} = renderHook(() => useInterviewQuestionTiming(round,attempt),{wrapper});
  await act(async () => result.current.onQuestionSelected("q2"));
  expect(send).toHaveBeenCalledTimes(1);
  await act(async () => result.current.onQuestionSelected("q1"));
  expect(send).toHaveBeenCalledTimes(2);
  expect(send.mock.calls[1][0]).toMatchObject({type:"selectQuestion",questionId:"q1"});
});


test("already queued navigation finishes when the view unmounts", async () => {
 let finish: (()=>void)|undefined;
 send.mockImplementationOnce(()=>new Promise(resolve=>{finish=()=>resolve({id:"round",version:1});}));
 send.mockResolvedValue({id:"round",version:1});
 const {result,unmount}=renderHook(()=>useInterviewQuestionTiming(round,attempt),{wrapper});
 act(()=>{result.current.onQuestionSelected("q2");result.current.onQuestionSelected("q1");});
 unmount();
 await act(async()=>finish?.());
 await waitFor(()=>expect(send).toHaveBeenCalledTimes(2));
});

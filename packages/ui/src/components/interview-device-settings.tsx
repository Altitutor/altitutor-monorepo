"use client";

import React, { useEffect, useRef, useState } from "react";
import type { DailyCall } from "@daily-co/daily-js";
import { Settings2 } from "lucide-react";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export interface InterviewInputSelection {
  audio: string;
  video: string;
}

export function InterviewDeviceSettings({
  call,
  callRef,
  selection,
  disabled,
  canSend,
  micOn,
  cameraOn,
}: {
  call: DailyCall | null;
  callRef: React.RefObject<DailyCall | null>;
  selection: React.MutableRefObject<InterviewInputSelection>;
  disabled: boolean;
  canSend: boolean;
  micOn: boolean;
  cameraOn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selected, setSelected] = useState(selection.current);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const operation = useRef(0);
  const mounted = useRef(true);
  const policy = useRef({ canSend, micOn, cameraOn });
  policy.current = { canSend, micOn, cameraOn };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      operation.current++;
    };
  }, []);

  useEffect(() => {
    operation.current++;
    busy.current = false;
    setPending(false);
    setError("");
  }, [call, disabled]);

  useEffect(() => {
    if (!open || !call || disabled) return;
    let active = true;
    let revision = 0;
    setLoading(true);
    setError("");
    const loaded = revision;
    void call
      .enumerateDevices()
      .then(({ devices: available }) => {
        if (active && callRef.current === call && loaded === revision) {
          setDevices(available);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active && callRef.current === call) {
          setError(
            "Unable to list inputs. Check browser camera and microphone permissions, then reopen these settings.",
          );
          setLoading(false);
        }
      });
    const changed = ({
      availableDevices,
    }: {
      availableDevices: MediaDeviceInfo[];
    }) => {
      if (!active || callRef.current !== call) return;
      revision++;
      setDevices(availableDevices);
      setLoading(false);
    };
    call.on("available-devices-updated", changed);
    return () => {
      active = false;
      call.off("available-devices-updated", changed);
    };
  }, [open, call, callRef, disabled]);

  const changeInput = async (
    kind: keyof InterviewInputSelection,
    deviceId: string,
  ) => {
    const instance = callRef.current;
    if (!instance || disabled || busy.current) return;
    const currentOperation = ++operation.current;
    const active = () =>
      mounted.current &&
      operation.current === currentOperation &&
      callRef.current === instance;
    busy.current = true;
    setPending(true);
    setError("");
    const applyPolicy = () => {
      const latest = policy.current;
      instance.setLocalAudio(latest.canSend && latest.micOn);
      instance.setLocalVideo(latest.canSend && latest.cameraOn);
    };
    try {
      applyPolicy();
      if (deviceId) {
        await instance.setInputDevicesAsync(
          kind === "audio"
            ? { audioDeviceId: deviceId }
            : { videoDeviceId: deviceId },
        );
      } else {
        // Empty settings return device selection to Daily's browser defaults.
        await instance.updateInputSettings({ [kind]: { settings: {} } });
      }
      if (!active()) return;
      const next = { ...selection.current, [kind]: deviceId };
      selection.current = next;
      setSelected(next);
    } catch {
      if (active())
        setError(
          "Unable to switch input. Choose another device or check its browser permissions.",
        );
    } finally {
      if (active()) {
        try {
          applyPolicy();
        } catch {
          /* The call may have ended during selection. */
        }
        busy.current = false;
        setPending(false);
      }
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Camera and microphone settings"
          className="rounded-full text-white hover:bg-white/20 hover:text-white"
        >
          <Settings2 />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="max-w-[calc(100vw-2rem)] space-y-4"
      >
        <h3 className="font-medium">Camera and microphone</h3>
        {disabled ? (
          <p className="text-sm text-muted-foreground">
            Enable camera and microphone to choose inputs.
          </p>
        ) : loading ? (
          <p role="status" className="text-sm text-muted-foreground">
            Finding inputs…
          </p>
        ) : null}
        {(["audio", "video"] as const).map((kind) => {
          const label = kind === "audio" ? "Microphone" : "Camera";
          const options = devices.filter(
            (device) =>
              device.kind === (kind === "audio" ? "audioinput" : "videoinput"),
          );
          const missing =
            !!selected[kind] &&
            !options.some((device) => device.deviceId === selected[kind]);
          return (
            <label key={kind} className="block space-y-1.5 text-sm">
              <span>{label}</span>
              <select
                aria-label={label}
                value={selected[kind]}
                disabled={disabled || !call || pending || loading}
                onChange={(event) => {
                  void changeInput(kind, event.target.value);
                }}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-foreground"
              >
                <option value="">Automatic (browser default)</option>
                {missing && (
                  <option value={selected[kind]} disabled>
                    Unavailable {label.toLowerCase()}
                  </option>
                )}
                {options
                  .filter((device) => device.deviceId)
                  .map((device, index) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `${label} ${index + 1}`}
                    </option>
                  ))}
              </select>
              {missing && !loading && (
                <span className="block text-xs text-muted-foreground">
                  This input is no longer available. Choose Automatic or another
                  input.
                </span>
              )}
            </label>
          );
        })}
        {pending && (
          <p role="status" className="text-xs text-muted-foreground">
            Switching input…
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Available choices depend on your browser and connected devices.
        </p>
      </PopoverContent>
    </Popover>
  );
}

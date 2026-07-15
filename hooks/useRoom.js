"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase";

const MAX_ROOM_MEMBERS = 5;
const STROKE_THROTTLE_MS = 16; // ~60fps
const CURSOR_THROTTLE_MS = 50;

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 to avoid confusion
  const array = new Uint8Array(6);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join("");
}

export function useRoom(userId, userName) {
  const [roomCode, setRoomCode] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState(null);

  const channelRef = useRef(null);
  const strokeCallbackRef = useRef(null);
  const clearCallbackRef = useRef(null);
  const lastStrokeTime = useRef(0);
  const lastCursorTime = useRef(0);
  const pendingPoints = useRef([]);
  const strokeTimerRef = useRef(null);

  const cleanup = useCallback(() => {
    if (strokeTimerRef.current) {
      clearInterval(strokeTimerRef.current);
      strokeTimerRef.current = null;
    }
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setIsConnected(false);
    setMembers([]);
    setRoomCode(null);
    setError(null);
  }, []);

  const subscribe = useCallback(
    (code) => {
      cleanup();

      const channel = supabase.channel(`room:${code}`, {
        config: {
          broadcast: { self: false },
          presence: { key: userId },
        },
      });

      // Listen for strokes
      channel.on("broadcast", { event: "stroke" }, ({ payload }) => {
        if (payload.userId !== userId && strokeCallbackRef.current) {
          strokeCallbackRef.current(payload);
        }
      });

      channel.on("broadcast", { event: "stroke_end" }, ({ payload }) => {
        // stroke end is handled implicitly when next stroke starts
      });

      channel.on("broadcast", { event: "clear" }, ({ payload }) => {
        if (payload.userId !== userId && clearCallbackRef.current) {
          clearCallbackRef.current(payload);
        }
      });


      // Presence tracking
      channel.on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const memberList = Object.values(state)
          .flat()
          .map((m) => ({
            userId: m.userId,
            userName: m.userName,
          }));
        setMembers(memberList);
      });

      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            userId,
            userName,
            joinedAt: new Date().toISOString(),
          });
          setIsConnected(true);
          setRoomCode(code);
          channelRef.current = channel;
        }
      });

      return channel;
    },
    [userId, userName, cleanup]
  );

  const createRoom = useCallback(() => {
    const code = generateRoomCode();
    subscribe(code);
    return code;
  }, [subscribe]);

  const joinRoom = useCallback(
    async (code) => {
      setError(null);

      // Validate format
      const sanitized = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (sanitized.length !== 6) {
        setError("Room code must be 6 characters");
        return false;
      }

      // Check member count via a temporary presence peek
      const tempChannel = supabase.channel(`room:${sanitized}-peek`);

      // We subscribe to the actual room and check presence after joining
      // If too many members, we'll leave immediately
      const channel = subscribe(sanitized);

      // Set a timeout to check member count after presence syncs
      setTimeout(() => {
        if (channelRef.current) {
          const state = channelRef.current.presenceState();
          const count = Object.keys(state).length;
          if (count > MAX_ROOM_MEMBERS) {
            setError(`Room is full (max ${MAX_ROOM_MEMBERS} users)`);
            cleanup();
            return false;
          }
        }
      }, 2000);

      return true;
    },
    [subscribe, cleanup]
  );

  const leaveRoom = useCallback(() => {
    cleanup();
  }, [cleanup]);

  const broadcastStroke = useCallback(
    (strokeData) => {
      if (!channelRef.current || !isConnected) return;

      const now = Date.now();
      if (now - lastStrokeTime.current >= STROKE_THROTTLE_MS) {
        channelRef.current.send({
          type: "broadcast",
          event: "stroke",
          payload: { ...strokeData, userId },
        });
        lastStrokeTime.current = now;
      }
    },
    [isConnected, userId]
  );

  const broadcastClear = useCallback(() => {
    if (!channelRef.current || !isConnected) return;
    channelRef.current.send({
      type: "broadcast",
      event: "clear",
      payload: { userId },
    });
  }, [isConnected, userId]);


  const onStrokeReceived = useCallback((callback) => {
    strokeCallbackRef.current = callback;
  }, []);

  const onClearReceived = useCallback((callback) => {
    clearCallbackRef.current = callback;
  }, []);


  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return {
    roomCode,
    isConnected,
    members,
    error,
    createRoom,
    joinRoom,
    leaveRoom,
    broadcastStroke,
    broadcastClear,
    onStrokeReceived,
    onClearReceived,
  };
}

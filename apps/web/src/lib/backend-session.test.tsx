import { beforeEach, afterEach, expect, test, vi } from "vitest";
import { AUTHORIZED_USER_ID, SESSION_KEY, clearSupabaseSession, savedSupabaseSession, validSupabaseSession } from "./backend";

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => vi.unstubAllGlobals());

test("migra a conexão existente e mantém a sessão após fechar a aba", () => {
  const session = { access_token: "access", refresh_token: "refresh", expires_at: Date.now() + 3600000 };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  expect(savedSupabaseSession()).toEqual(session);
  sessionStorage.clear();
  expect(savedSupabaseSession()).toEqual(session);
  clearSupabaseSession();
  expect(savedSupabaseSession()).toBeNull();
});

test("renova uma única vez para consultas simultâneas sem pedir senha", async () => {
  const session = { access_token: "old", refresh_token: "refresh", expires_at: 0 };
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ access_token: "new", refresh_token: "rotated", expires_in: 3600, user: { id: AUTHORIZED_USER_ID } })));
  vi.stubGlobal("fetch", fetcher);
  const [a, b] = await Promise.all([validSupabaseSession(session), validSupabaseSession(session)]);
  expect(a.access_token).toBe("new");
  expect(a).toEqual(b);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(savedSupabaseSession()?.refresh_token).toBe("rotated");
  await validSupabaseSession(session);
  expect(fetcher).toHaveBeenCalledTimes(1);
});


test("renovação pendente não restaura a sessão depois de sair da plataforma", async () => {
  let release!: (response: Response) => void;
  const pending = new Promise<Response>(resolve => { release = resolve; });
  vi.stubGlobal("fetch", vi.fn(() => pending));
  const refreshing = validSupabaseSession({ access_token: "old", refresh_token: "old", expires_at: 0 });
  clearSupabaseSession();
  release(new Response(JSON.stringify({ access_token: "new", refresh_token: "new", expires_in: 3600, user: { id: AUTHORIZED_USER_ID } })));
  await expect(refreshing).rejects.toThrow("Sessão encerrada");
  expect(savedSupabaseSession()).toBeNull();
});

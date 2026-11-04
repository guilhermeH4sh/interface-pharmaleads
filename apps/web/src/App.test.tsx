import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { App } from "./App";

afterEach(() => vi.unstubAllGlobals());

function fakeApi() {
  return vi.fn(async (path: string, options?: RequestInit) => {
    let body: unknown;
    if (path === "/api/config") body = { segmentos: [{id:"varejo",descricao:"Farmácias e drogarias de balcão"},{id:"manipulacao",descricao:"Farmácias de manipulação"}] };
    else if (path === "/api/status") body = { total_leads: 1, execucao: null, consulta_atual: null };
    else if (path.startsWith("/api/leads")) body = { items: [{chave:"abc",nome:"Farmácia teste",categoria:"Farmácia",local_busca:"Curitiba, PR",segmento:"varejo",telefone:"(41) 3333-4444",situacao:"ativa_ou_desconhecida"}], total:1, next_offset:null };
    else if (path === "/api/coletas" && options?.method === "POST") body = {id:1};
    else body = {};
    return { ok:true, json: async () => body };
  });
}

test("exibe leads reais retornados pela API e filtros", async () => {
  const fetcher=fakeApi(); vi.stubGlobal("fetch",fetcher); render(<App />);
  expect(await screen.findByText("Farmácia teste")).toBeVisible();
  expect(screen.getByText("SQLite local")).toBeVisible();
  await userEvent.type(screen.getByLabelText("Buscar estabelecimentos"),"Curitiba");
  await waitFor(()=>expect(fetcher.mock.calls.some(call=>String(call[0]).includes("q=Curitiba"))).toBe(true));
});

test("envia locais e segmentos para iniciar coleta", async () => {
  const fetcher=fakeApi(); vi.stubGlobal("fetch",fetcher); render(<App />);
  await screen.findByText("Farmácia teste");
  await userEvent.type(screen.getByLabelText("Pesquisar cidade, estado ou bairro"),"Curitiba, PR");
  await userEvent.click(screen.getByRole("button",{name:"Adicionar local"}));
  await userEvent.click(screen.getByRole("button",{name:/Iniciar coleta/}));
  await waitFor(()=>expect(fetcher.mock.calls.some(call=>call[0] === "/api/coletas" && call[1]?.method === "POST")).toBe(true));
  const chamada=fetcher.mock.calls.find(call=>call[0] === "/api/coletas");
  expect(JSON.parse(String(chamada?.[1]?.body))).toMatchObject({locais:["Curitiba, PR"],segmentos:["varejo","manipulacao"],profundidade:1});
});

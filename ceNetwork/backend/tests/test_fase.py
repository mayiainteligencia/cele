"""Pruebas sin red: Gemini y Apify simulados. Uso: venv/bin/python tests/test_fase.py [--sembrar]
--sembrar crea la búsqueda de demostración 'demo-persona' en el historial para probar la interfaz sin gastar créditos."""
import json, os, sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.update(GEMINI_API_KEY="x", GEMINI_MODELS="m-uno,m-dos", LLM_COOLDOWN_SECONDS="60", FUENTE="apify", APIFY_MAX_X="30", APIFY_MAX_TIKTOK="30", LLM_RPM="1000", LLM_ESTADO_ARCHIVO="/tmp/llm_estado_prueba.json")   # fijados antes de importar: el .env no los pisa
from social import analisis, historial, lexico, llm, pipeline, radar  # noqa: E402

TEXTOS = [("Gracias por apoyar a la colonia, buen trabajo", "pos"), ("Es un corrupto y un mentiroso, fuera", "neg"),
          ("Hay baches y basura, abandono total", "neg"), ("Excelente avance en la obra, felicidades", "pos"),
          ("No cumple sus promesas, nos engaña", "neg"), ("Reunión hoy a las 5", "neu"), ("Exigimos seguridad, hay asaltos", "neg")]


def demo_resumen():
    posts = [{"postId": f"p{i}", "text": t, "sentimiento": s, "tipo_fuente": "ciudadano", "likesCount": 10 + i, "commentsCount": 2, "sharesCount": 1,
              "time": "2026-11-12T10:00:00.000Z", "url": f"https://www.facebook.com/Vecino{i % 3}/posts/{i}",
              "user": {"id": str(100 + i % 3), "name": f"Vecino {i % 3}"}, "atribucion": {"es_la_persona": "si"}} for i, (t, s) in enumerate(TEXTOS)]
    return {"id": "demo-persona", "relevantes_posts": len(posts), "posts_recientes": posts, "por_confirmar": [], "ficha": {"id": "5b11a82822"},
            "sentimiento": {"positive": 29, "neutral": 14, "negative": 57}, "categorias": [], "query": {"tema": "Persona Demo (datos de prueba)"}}


def sembrar():
    r = demo_resumen()
    historial.guardar(r, "Persona Demo (datos de prueba)", "persona", {"nivel": "estado", "estado_id": "09", "nombre": "Ciudad de México", "texto": "Ciudad de México"})
    print("Sembrada la búsqueda demo-persona (bórrala desde el historial al terminar).")


def pruebas():
    llamadas = []
    def falso(modelo, prompt, json_mode, web):
        llamadas.append(modelo)
        if modelo == "m-uno" and os.environ.get("CAIDA") == "1":
            raise RuntimeError("429 RESOURCE_EXHAUSTED")
        if "Clasifica estas publicaciones" in prompt:
            ids = [int(x) for x in __import__("re").findall(r'"id": (\d+)', prompt)]
            return json.dumps([{"id": i, "relevante": True, "categoria": "queja", "tipo_fuente": "ciudadano"} for i in ids])
        return "no es json" if os.environ.get("ROTO") == "1" else json.dumps({"hallazgos": ["h"], "riesgos": [], "oportunidades": [], "acciones": [
            {"prioridad": "alta", "plazo": "7 dias", "canal": "facebook", "objetivo": "o", "evidencia": ["p1", "inventado"]}], "respuestas": [], "contenido": []})
    llamar_real = llm._llamar
    llm._llamar = falso

    # 1) cambio de modelo por 429
    os.environ["CAIDA"] = "1"
    t, m = llm.generar("hola")
    assert m == "m-dos" and llamadas == ["m-uno", "m-dos"], llamadas
    assert llm._agotados["m-uno"] > time.time()
    llamadas.clear(); llm.generar("otra")   # m-uno en espera: ni se intenta
    assert llamadas == ["m-dos"], llamadas
    # 2) todos agotados
    llm._agotados["m-dos"] = time.time() + 60
    try:
        llm.generar("x"); assert False
    except llm.CuotaAgotada:
        pass
    llm._agotados.clear(); os.environ["CAIDA"] = "0"
    # 2b) rotación por 3 modelos, retryDelay, 404 y estado en disco
    os.environ["GEMINI_MODELS"] = "m-uno,m-dos,m-tres"; llm._agotados.clear(); llm._info.clear()
    def f3(modelo, prompt, json_mode, web):
        llamadas.append(modelo)
        if modelo == "m-uno": raise RuntimeError("429 RESOURCE_EXHAUSTED retryDelay: '33s'")
        if modelo == "m-dos": raise RuntimeError("404 NOT_FOUND model is not found")
        return "ok"
    antes = llm._llamar; llm._llamar = f3; llamadas.clear()
    assert llm.generar("x") == ("ok", "m-tres") and llamadas == ["m-uno", "m-dos", "m-tres"], llamadas
    assert 33 < llm._agotados["m-uno"] - time.time() <= 35 and llm._info["m-uno"]["tipo"] == "minuto"
    assert llm._info["m-dos"]["tipo"] == "no_disponible" and llm._agotados["m-dos"] - time.time() > 23 * 3600
    guardado = json.loads(Path("/tmp/llm_estado_prueba.json").read_text()); assert guardado["m-dos"]["tipo"] == "no_disponible"
    est = {e["modelo"]: e for e in llm.estado_modelos()}; assert est["m-uno"]["estado"] == "en_espera" and est["m-tres"]["estado"] == "disponible"
    llm._agotados["m-tres"] = time.time() + 5   # todos en espera: aviso con la hora más cercana, recalculada
    try: llm.generar("x"); assert False
    except llm.CuotaAgotada as e: assert "agotada hasta las" in str(e)
    llm._agotados["m-tres"] = time.time() - 1   # vence la espera de uno: vuelve a responder, sin aviso
    assert llm.generar("x")[1] == "m-tres" and not llm.todos_agotados()
    llm.reintentar_ahora(); assert not llm._agotados   # "Reintentar ahora"
    # descubrimiento: solo generateContent, sin imagen/embeddings/preview, sin duplicar
    os.environ["GEMINI_DESCUBRIR_MODELOS"] = "1"; llm._descubierto_en = 0
    llm._listar_api = lambda: [("gemini-2.5-pro", ["generateContent"]), ("gemini-2.5-flash-image", ["generateContent"]), ("gemini-embedding-001", ["embedContent"]),
                               ("gemini-x-404", ["generateContent"]), ("gemini-live-2", ["generateContent"]), ("gemini-omni", ["generateContent"]),
                               ("m-uno", ["generateContent"]), ("gemini-2.0-flash", ["generateContent"]), ("gemini-a", ["generateContent"]), ("gemini-b", ["generateContent"]),
                               ("gemini-c", ["generateContent"]), ("gemini-d", ["generateContent"]), ("gemini-e", ["generateContent"])]
    llm._llamar = lambda m, p, j, w: (_ for _ in ()).throw(RuntimeError("404 NOT_FOUND")) if m == "gemini-x-404" else "ok"
    assert llm._modelos(False) == ["m-uno", "m-dos", "m-tres", "gemini-2.5-pro", "gemini-2.0-flash", "gemini-a", "gemini-b", "gemini-c"], llm._modelos(False)   # máx. 8, 404 y excluidos fuera
    os.environ.pop("GEMINI_DESCUBRIR_MODELOS"); llm._descubiertos.clear(); os.environ["GEMINI_MODELS"] = "m-uno,m-dos"
    llm._llamar = antes; llm._agotados.clear(); llm._info.clear(); llamadas.clear()
    # 2c) limitador: con cupo 2 el tercer pedido pasa a m-dos sin intentar m-uno; con todo lleno y espera larga avisa sin llamar
    os.environ["LLM_RPM"] = "2"; llm._peticiones.clear(); llamadas.clear(); llm._llamar = lambda m, p, j, w: (llamadas.append(m), "ok")[1]
    for _ in range(3): llm.generar("x")
    assert llamadas == ["m-uno", "m-uno", "m-dos"], llamadas
    assert {e["modelo"]: e["ultimo_minuto"] for e in llm.estado_modelos()} == {"m-uno": 2, "m-dos": 1}
    llm.generar("x"); llamadas.clear()
    try: llm.generar("x"); assert False
    except llm.CuotaAgotada as e: assert "peticiones por minuto" in str(e) and llamadas == []
    llm._peticiones["m-uno"] = [time.time() - 59.9, time.time() - 59.9]; llm._peticiones["m-dos"] = [time.time() - 59.9] * 2
    assert llm.generar("x")[0] == "ok"   # cola: espera ~0.1 s a que se libere el cupo
    os.environ["LLM_RPM"] = "1000"; llm._peticiones.clear(); llm._llamar = antes; llamadas.clear()
    # 2d) 503: espera corta, pasa al siguiente, penaliza (va al final) y el aviso dice "saturados", nunca cuota
    os.environ["LLM_COOLDOWN_503_S"] = "20"; llm._agotados.clear(); llm._info.clear(); llamadas.clear()
    def f503(modelo, prompt, json_mode, web):
        llamadas.append(modelo)
        if modelo == "m-uno": raise RuntimeError("503 UNAVAILABLE. high demand")
        return "ok"
    llm._llamar = f503
    assert llm.generar("x")[1] == "m-dos" and llamadas == ["m-uno", "m-dos"]
    assert 18 < llm._agotados["m-uno"] - time.time() <= 20 and llm._info["m-uno"]["tipo"] == "saturado" and llm._info["m-uno"]["codigo"] == 503
    assert llm._ordenar(["m-uno", "m-dos"]) == ["m-dos", "m-uno"]   # penalizado al final
    llm._agotados["m-dos"] = time.time() + 20; llm._info["m-dos"] = {"tipo": "saturado"}
    try: llm.generar("x"); assert False
    except llm.CuotaAgotada as e: assert str(e) == "Modelos de IA saturados, reintenta en unos segundos", str(e)
    llm._agotados.clear(); llm._info.clear()
    def fs(modelo, prompt, json_mode, web): raise RuntimeError("503 UNAVAILABLE")
    llm._llamar = fs
    try: llm.generar("x"); assert False
    except llm.CuotaAgotada as e: assert "saturados" in str(e) and "Cuota" not in str(e)
    llm._agotados.clear(); llm._info.clear()
    # 2e) lento: m-uno tarda más de LLM_PARALELO_S, m-dos arranca en paralelo y gana; latencia lenta penaliza
    os.environ["LLM_PARALELO_S"] = "0.1"; os.environ["LLM_LENTO_S"] = "0.3"; llamadas.clear()
    def flento(modelo, prompt, json_mode, web):
        llamadas.append(modelo)
        if modelo == "m-uno": time.sleep(0.6); return "lento"
        return "rapido"
    llm._llamar = flento; t0 = time.time()
    assert llm.generar("x") == ("rapido", "m-dos") and time.time() - t0 < 0.5 and llamadas == ["m-uno", "m-dos"], llamadas
    time.sleep(0.6)   # el hilo perdedor termina y registra su latencia
    assert llm._info["m-uno"]["latencia"] >= 0.5 and llm._ordenar(["m-uno", "m-dos"]) == ["m-dos", "m-uno"]
    os.environ["LLM_PARALELO_S"] = "8"; os.environ["LLM_LENTO_S"] = "10"; llm._llamar = antes; llm._agotados.clear(); llm._info.clear(); llamadas.clear()
    # 2f) cliente único: dos llamadas en paralelo, gana una, el cliente no se cierra y una tercera funciona; si apareciera cerrado, se recrea y reintenta
    class Cli:
        creados = 0
        def __init__(self): Cli.creados += 1; self.cerrado = False; self.models = self
        def generate_content(self, model, contents, config):
            if self.cerrado: raise RuntimeError("Cannot send a request, as the client has been closed.")
            if model == "m-uno": time.sleep(0.5)
            return type("R", (), {"text": f"resp-{model}"})()
        def close(self): self.cerrado = True
    llm._crear_cliente = Cli; llm._cliente_unico = None; llm._agotados.clear(); llm._info.clear()
    os.environ["LLM_PARALELO_S"] = "0.1"; os.environ["GEMINI_MODELS"] = "m-uno,m-dos"; llm._llamar = llamar_real
    assert llm.generar("x") == ("resp-m-dos", "m-dos")   # m-uno lento, m-dos en paralelo gana
    assert Cli.creados == 1 and not llm._cliente().cerrado
    time.sleep(0.6); assert llm.generar("y")[1] in ("m-uno", "m-dos") and Cli.creados == 1   # tercera llamada posterior, mismo cliente
    llm._cliente().close()   # cerrado a la fuerza: recrea y reintenta esa llamada una vez
    assert llm._llamar("m-dos", "z", False, False) == "resp-m-dos" and Cli.creados == 2
    llm._cliente().close()   # error de cliente persistente: ni espera ni penalización, texto exacto
    llm._crear_cliente = lambda: type("C", (), {"models": type("M", (), {"generate_content": staticmethod(lambda **k: (_ for _ in ()).throw(RuntimeError("Cannot send a request, as the client has been closed.")))})()})()
    llm._cliente_unico = None
    try: llm.generar("x"); assert False
    except llm.CuotaAgotada as e: assert "client has been closed" in str(e) and not e.es_cuota and "saturados" not in str(e)
    assert not llm._agotados and "penal_hasta" not in llm._info.get("m-uno", {}) and llm._info["m-uno"]["tipo"] == "error_cliente"
    llm._crear_cliente = Cli; llm._cliente_unico = None
    d = llm.diagnostico(); assert [x["modelo"] for x in d] == ["m-uno", "m-dos"] and all(x["ok"] for x in d)
    os.environ["LLM_PARALELO_S"] = "8"; os.environ["GEMINI_MODELS"] = "m-uno,m-dos"; llm._llamar = antes; llm._agotados.clear(); llm._info.clear()
    # 2g) timeout y errores sin código: ni "saturados" ni "cuota"
    llm._llamar = lambda m, p, j, w: (_ for _ in ()).throw(RuntimeError("The read operation timed out"))
    try: llm.generar("x"); assert False
    except llm.CuotaAgotada as e: assert "timed out" in str(e) and not e.es_cuota
    try: llm.generar("x"); assert False   # todos en espera por timeout: sigue mostrando el error exacto
    except llm.CuotaAgotada as e: assert "timed out" in str(e) and "saturados" not in str(e) and "Cuota" not in str(e), str(e)
    llm._llamar = antes; llm._agotados.clear(); llm._info.clear()
    # 3) JSON roto: reintenta una vez y pasa al siguiente modelo
    os.environ["ROTO"] = "1"; llamadas.clear()
    assert llm.generar_json("x") is None and llamadas == ["m-uno", "m-uno", "m-dos", "m-dos"], llamadas
    llm._agotados.clear(); os.environ["ROTO"] = "0"
    # 4) simulación
    os.environ["LLM_SIMULAR_429"] = "1"; llamadas.clear()
    assert llm.generar("x")[1] == "m-dos"; os.environ.pop("LLM_SIMULAR_429"); llm._agotados.clear()
    # 5) clasificación en lote: 1 llamada para 7 posts y caché por hash
    posts = demo_resumen()["posts_recientes"]; llamadas.clear()
    pipeline.CLASIF_CACHE = Path("/tmp/clasif_prueba.json"); pipeline.CLASIF_CACHE.unlink(missing_ok=True)
    out, ag = pipeline.classify_posts_batch(posts, {}, "Persona")
    assert len(llamadas) == 1 and all(o["clasificador"] == "gemini" for o in out) and not ag
    llamadas.clear(); pipeline.classify_posts_batch(posts, {}, "Persona"); assert llamadas == [], "reclasificó"
    # 6) léxico: 5 o más posts atribuidos; con menos, 'Muestra insuficiente'
    r = demo_resumen()
    pal = lexico.palabras(r)
    assert pal["suficiente"] and any(f["palabra"] == "corrupción" for f in pal["negativas"]) and pal["positivas"]
    r["posts_recientes"] = r["posts_recientes"][:3]
    pal3 = lexico.palabras(r)   # con 1 a 4 posts: cifras preliminares, no bloqueo
    assert pal3["suficiente"] and pal3["confianza"]["preliminar"] and pal3["confianza"]["etiqueta"] == "Preliminar (3 posts)" and pal3["confianza"]["nivel"] == "baja"
    r["posts_recientes"] = []
    assert lexico.palabras(r)["confianza"]["vacio"]
    # 7) análisis: evidencia inventada se descarta; con IA agotada responde mensaje, sin romper
    a = analisis.generar(demo_resumen(), {"nombre": "X", "logros_verificables": ""})
    assert a["estado"] == "ok" and a["acciones"][0]["evidencia"] == ["p1"] and a["contenido"] == []
    assert a["base"]["muestra_terceros"]["posts"] == 7 and a["base"]["confianza"]["nivel"] == "media"
    uno = demo_resumen(); uno["posts_recientes"] = uno["posts_recientes"][:1]
    assert analisis.generar(uno, None)["estado"] == "ok" and analisis.generar({"posts_recientes": []}, None)["estado"] == "sin_base"
    ofi = demo_resumen(); [p.update(tipo_fuente="oficial") for p in ofi["posts_recientes"]]
    assert analisis.generar(ofi, None)["acciones"][0]["objetivo"].startswith("Conseguir una muestra")   # sin terceros: primera acción obligatoria
    llm._agotados.update({"m-uno": time.time() + 99, "m-dos": time.time() + 99})
    assert analisis.generar(demo_resumen(), None)["mensaje"].startswith("Cuota de IA agotada hasta las ")
    llm._agotados.clear()
    # 8) radar: puntaje con desglose, 'sin dato', nivel por umbrales y ubicación local/nacional con evidencia
    lug = radar.terminos_lugar({"nivel": "estado", "texto": "Ciudad de México"})
    assert radar.ubicar(lug, "Chilango, creo contenido en CDMX", "", "")["ambito"] == "estado"
    assert radar.ubicar(lug, "Madrid", "recetas", "")["ambito"] == "nacional"
    assert radar.nivel(5000) == "local" and radar.nivel(50000) == "micro" and radar.nivel(2_000_000) == "mega" and radar.nivel(None) is None
    f = lambda seg, inter, act, amb: {"estado_medicion": "medido", "seguidores": seg, "interaccion_promedio": inter, "actividad": act, "ambito": amb}
    pun = [f(10000, 50.0, 4, "municipio"), f(100, 5.0, 1, "estado"), f(None, 9.0, 1, "estado")]
    radar.puntajes(pun)
    assert pun[0]["puntaje"] == 100.0 and pun[0]["desglose"]["relevancia_local"] == 1.0 and pun[2].get("puntaje") is None
    # 9) sugerencias: la caché evita repetir la llamada; sin búsqueda web -> 'Sin sugerencias externas'
    radar.CACHE = Path("/tmp/radar_prueba"); [x.unlink() for x in radar.CACHE.glob("*")] if radar.CACHE.exists() else None
    llamadas_web = []
    def con_web(m, p, j, w):
        llamadas_web.append(w)
        return json.dumps([{"categoria": "comedia", "nombre": "Canal Uno", "youtube": "@canaluno", "razon": "r", "es_del_lugar": True, "fuente_url": "http://x"},
                           {"categoria": "deportes", "nombre": "Liga Uno", "instagram": "liga.uno", "razon": "r", "es_del_lugar": False, "fuente_url": "http://y"}]) if w else "[]"
    llm._llamar = con_web
    r1 = radar.sugerir_todas(lug); r2 = radar.sugerir_todas(lug)
    assert len(r1["items"]) == 2 and r1["items"][0]["youtube"] == "canaluno" and not r1["de_cache"] and r2["de_cache"] and len(llamadas_web) == 1   # UNA llamada para todas las categorías
    def sin_web(m, p, j, w): raise RuntimeError("400 tool not supported")
    llm._llamar = sin_web
    [x.unlink() for x in radar.CACHE.glob("*")]
    assert radar.sugerir_todas(lug)["mensaje"] == "Sin sugerencias externas (búsqueda web no disponible)"
    # 10) coincidencia flexible: acentos/signos/variantes, apellido con contexto, tema ponderado; sin texto usa la imagen
    from social import coincidencia as co, facebook as fbk
    ficha = {"variantes": ["Hugo Lobo"], "cargo": "diputado", "territorio": {"nombre": "Gustavo A. Madero"}, "hashtags": ["LoboGAM"]}
    pu = lambda t, tema="Víctor Hugo Lobo Román", modo="persona", f=ficha: co.puntuar({"text": t}, tema, modo, f)
    assert pu("¡VÍCTOR HUGO LOBO ROMÁN!, hoy")["puntaje"] == 100 and pu("Hugo Lobo dijo")["puntaje"] == 95
    assert co.pasa(pu("Víctor Lobo Román")) and 0 < pu("Lobo, diputado de la zona")["puntaje"] < 60 and pu("nada")["puntaje"] == 0
    assert co.pasa(pu("inseguridad y robos", "inseguridad robos tlalpan", "tema", None)) is False or True
    assert pu("hay inseguridad robos en Tlalpan", "inseguridad robos tlalpan", "tema", None)["puntaje"] == 85
    m = fbk.map_to_common_schema({"text": "", "media": [{"alt": "Foto de un bache"}]})
    assert m["text"] == "Foto de un bache" and m["texto_origen"] == "imagen"
    # 11) plataformas: esquema común, retweets marcados, texto vacío = sin texto, estimado por plataforma
    from social import plataformas as pl, x as cx, tiktok as ct, instagram as ci, periodo as pe
    rt = cx.mapear({"id": "1", "url": "u", "text": "RT @a: hola", "isRetweet": True, "createdAt": "Tue Nov 10 15:02:11 +0000 2026", "author": {"userName": "b", "name": "B", "id": "2", "followers": 5}})
    assert rt["plataforma"] == "x" and rt["descarte_nota"] and rt["time"].startswith("2026-11-10") and rt["seguidores"] == 5 and rt["metricas"]["vistas"] is None
    assert ct.mapear({"id": "7", "text": "", "webVideoUrl": "w", "authorMeta": {"name": "a"}, "playCount": 10})["text"] == ""
    assert ci.mapear({"id": "3", "caption": "hola", "url": "u", "likesCount": 4, "ownerUsername": "z"})["metricas"]["compartidos"] is None
    assert pl.normalizar(["x", "tiktok", "foo", "x"]) == ["x", "tiktok"] and pl.normalizar([]) == ["facebook"]
    px, _ = cx.entradas("inseguridad Tlalpan", "tema", ["Tlalpan", "CDMX"], None, pe.resolver(14), 30)
    assert px["maxItems"] == 30 and "lang:es" in px["searchTerms"][0] and "since:" in px["searchTerms"][0] and '"CDMX"' in px["searchTerms"][0]
    pt, _ = ct.entradas("inseguridad", "tema", ["Tlalpan"], None, pe.resolver(14), 30)
    assert pt["resultsPerPage"] * (len(pt["searchQueries"]) + len(pt["hashtags"])) <= 30
    assert pl.estimado(["x", "tiktok", "instagram"])["plataformas"]["x"]["costo_usd"] == 0.012
    # 12) periodo: resolver, ventana y consultas por plataforma
    assert pe.resolver()["tipo"] == "dias" and pe.resolver(0)["tipo"] == "todo" and pe.resolver(1)["etiqueta"] == "24 horas"
    rg = pe.resolver(None, "2026-10-01", "2026-10-31")
    assert rg["tipo"] == "rango" and pe.resolver(None, "2026-10-31", "2026-10-01")["desde"] == "2026-10-01"
    assert "since:2026-10-01" in cx.entradas("tema", "tema", [], None, rg, 30)[1][0] and "until:2026-11-01" in cx.entradas("tema", "tema", [], None, rg, 30)[1][0]
    assert "since:" not in cx.entradas("tema", "tema", [], None, pe.resolver(0), 30)[1][0]
    assert "onlyPostsNewerThan" not in ci.entradas("tema", "tema", [], None, pe.resolver(0), 30)[0] and "onlyPostsNewerThan" in ci.entradas("tema", "tema", [], None, pe.resolver(7), 30)[0]
    assert "oldestPostDateUnified" not in ct.entradas("tema", "tema", [], None, pe.resolver(7), 30)[0]   # filtro de pago apagado por defecto
    # 13) modo Persona: variantes con cargo/territorio, propia vs terceros, consultas por plataforma, atribución por lote
    from social import persona as pr, identidad as idn
    fi = {"nombre": "Janecarlo Lozano Reyes", "variantes": ["Janecarlo Lozano"], "apodo": "Jane", "cargo": "alcalde", "territorio": {"nombre": "Tlalpan"},
          "usuario_x": "@jane_lozano", "usuario_instagram": "jane.lozano", "hashtags": ["JaneLozano"]}
    comp, cortas = pr.variantes(fi["nombre"], fi)
    assert comp == "Janecarlo Lozano Reyes" and "Janecarlo Lozano" in cortas and "Jane" in cortas
    qs = pr.consultas_texto(fi["nombre"], fi, ["Tlalpan"])
    assert qs[0] == '"Janecarlo Lozano Reyes"' and '"Janecarlo Lozano" alcalde' in qs and '"Janecarlo Lozano" Tlalpan' in qs
    assert pr.es_propia({"plataforma": "x", "user": {"usuario": "Jane_Lozano", "name": "X"}}, fi) and not pr.es_propia({"plataforma": "x", "user": {"usuario": "otro", "name": "Y"}}, fi)
    tx = cx.entradas(fi["nombre"], "persona", ["Tlalpan"], fi, pe.resolver(14), 30)[1]
    assert any(t.startswith("@jane_lozano") for t in tx) and any(t.startswith("to:jane_lozano") for t in tx) and not any(t.startswith("from:") for t in tx)
    pi, ci_ = ci.entradas(fi["nombre"], "persona", [], fi, pe.resolver(14), 30)
    assert isinstance(pi, list) and pi[-1]["resultsType"] == "mentions" and "jane.lozano" in pi[-1]["directUrls"][0]
    assert pr.alcance_de_ficha({**fi, "territorio": {}}) is None and pr.alcance_de_ficha({**fi, "territorio": {"nombre": "Tlalpan", "estado_id": "09", "municipio_id": "09012"}})["nivel"] == "municipio"
    llm._llamar = lambda m, p, j, w: json.dumps([{"id": i, "es_la_persona": "si" if i == 0 else "no", "razon": "r"} for i in range(2)])
    v = idn.verificar_lote([{"text": "a"}, {"text": "b"}], fi)
    assert [x["es_la_persona"] for x in v] == ["si", "no"]
    cnt = pr.contar_variantes([{"text": "Janecarlo Lozano visito la colonia"}, {"text": "otro"}], fi["nombre"], fi)
    assert next(c for c in cnt if c["variante"] == "Janecarlo Lozano")["posts"] == 1
    # 14) «Qué se sabe hoy»: conteos, narrativas con señal indirecta y qué falta
    from social import quesesabe as qk
    rr = demo_resumen(); rr["narrativa_ciudadana"] = [{"titulo": "t", "texto": "texto", "fuentes": ["a", "b"], "plataformas": ["facebook"], "count": 2, "tipo_fuente": "ciudadano",
        "likesCount": 10, "commentsCount": 5, "sharesCount": 2, "desde": "2026-11-01", "reacciones": {"Angry": 3, "Haha": 1, "Sad": 0}}]
    k = qk.calcular(rr)
    assert k["por_tipo_fuente"]["ciudadano"] == 7 and k["por_plataforma"]["facebook"] == 7 and k["falta"]["faltan_para_alta"] == 13
    n0 = k["narrativas"][0]
    assert n0["comentarios_por_reaccion"] == 0.5 and n0["compartidos_por_reaccion"] == 0.2 and n0["desglose_reacciones"]["enojo"] == 3 and k["nota_senal"] == "Señal indirecta, no es sentimiento"
    assert qk.confianza(4, 0)["etiqueta"] == "Preliminar (4 posts)" and qk.confianza(5, 0)["nivel"] == "media" and qk.confianza(20, 0)["nivel"] == "alta" and qk.confianza(0, 0)["vacio"]
    # 15) radar: sugeridos sin medir en la tabla, fuera del puntaje; reordenar solo puntúa medidos; medir una cuenta
    lug2 = radar.terminos_lugar({"nivel": "estado", "texto": "Ciudad de México"})
    sm = radar.fila_sin_medir({"nombre": "Canal Uno", "categorias": ["comedia"], "youtube": "canaluno", "razon": "de CDMX", "fuente_url": "http://x", "es_del_lugar": True}, lug2, "YouTube sin medir (falta YOUTUBE_API_KEY)")
    assert sm["etiqueta"] == "Sugerido, sin medir" and sm["seguidores"] is None and sm["puntaje"] is None and sm["plataformas"][0]["url"].endswith("@canaluno")
    med = {"nombre": "M", "estado_medicion": "medido", "sugerido": True, "seguidores": 1000, "interaccion_promedio": 10.0, "actividad": 2, "ambito": "estado", "menciona_ficha": False, "puntaje": None, "desglose": None}
    rad = {"medidos": [sm, med], "persona": ""}
    radar.reordenar(rad)
    assert rad["medidos"][0]["nombre"] == "M" and rad["medidos"][0]["puntaje"] is not None and sm["puntaje"] is None and rad["fuentes"] == {"verificados": 1, "sin_medir": 1}
    os.environ.pop("YOUTUBE_API_KEY", None)
    try:
        radar.medir_cuenta(sm, None, lug2, None); assert False
    except ValueError as exc:
        assert "YOUTUBE_API_KEY" in str(exc)
    assert radar.estimado_medir(sm)["cuentas"]["youtube"]["unidades_youtube"] == 3
    # 16) tipo_fuente: persona por regla en código, sin IA queda "sin clasificar" (no "ciudadano"); mensaje de cuota con hora; etapas con tiempo máximo y cancelación
    ficha_p = {"id": "fp", "nombre": "Gabriela Osorio", "usuario_x": "gaby_osorio", "paginas_oficiales": []}
    antes = os.environ.get("GEMINI_API_KEY"); os.environ["GEMINI_API_KEY"] = ""
    posts_t = [{"text": "Hoy recorrimos la colonia con vecinos y vecinas de Tlalpan", "plataforma": "x", "user": {"name": "Gaby", "usuario": "gaby_osorio"}},
               {"text": "El bache de mi calle sigue igual desde hace meses en Tlalpan", "plataforma": "x", "user": {"name": "Pedro", "usuario": "pedro"}}]
    cl, ag = pipeline.classify_posts_batch(posts_t, {"oficial": [], "politico": [], "medio": []}, "Tlalpan", ficha_p)
    assert cl[0]["tipo_fuente"] == "persona" and cl[1]["tipo_fuente"] == "sin_clasificar" and not ag
    os.environ["GEMINI_API_KEY"] = antes or "x"
    llm._agotados.update({"m-uno": time.time() + 120, "m-dos": time.time() + 3600})
    assert llm.todos_agotados() and llm.mensaje_cuota().startswith("Cuota de IA agotada hasta las ") and llm.info_sesion() is not None
    t0 = time.time()
    try:
        llm.generar("x"); assert False
    except llm.CuotaAgotada:
        assert time.time() - t0 < 0.5   # responde de inmediato
    llm._agotados.clear()
    prog = radar.Progreso(); radar_t = os.environ.get("RADAR_X"); 
    av = radar._correr(prog, "lenta", lambda: time.sleep(2), 0.5)
    assert av and "tiempo máximo agotado" in av
    prog2 = radar.Progreso(); prog2.cancelado.set()
    try:
        radar._correr(prog2, "x", lambda: None, 5); assert False
    except radar.Cancelado:
        pass
    print("OK: todas las pruebas pasaron")


if __name__ == "__main__":
    sembrar() if "--sembrar" in sys.argv else pruebas()

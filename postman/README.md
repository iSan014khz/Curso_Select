# Atribucion de anuncios: contrato y comprobaciones locales

`/g/:codigo` registra `destino=web` y redirige a `/?ref=:codigo`. Los botones de
contacto conservan la referencia mediante `/w/:codigo`. `/w/:codigo` registra
`destino=wa` y abre WhatsApp con el numero de negocio `522212043005`.
Solo se propagan codigos de seis letras minusculas o digitos. Un codigo con
formato valido pero inexistente puede redirigir; la RPC lo rechaza al registrar.

El mensaje es `Hola, me interesa el curso BUAP 2027. ¿Me compartes informacion?`
(con el acento de informacion en el mensaje real), seguido de una referencia
invisible version 1. Inicio: U+2063 U+2060; fin: U+2060 U+2063. La carga ASCII
`1:codigo:checksum` se transforma byte a byte en ocho bits: 0 U+200B, 1 U+200C.
El checksum son los primeros cuatro hexadecimales de SHA256(codigo). Es control
de integridad accidental, no autenticacion. El receptor debe verificar tambien
que la publicacion exista; no atribuir una venta por cercania temporal al clic.

La RPC `POST /rest/v1/rpc/registrar_clic` recibe `p_codigo`, `p_destino`,
`p_es_bot`, `p_ip_hash` y `p_ua_hash`, y devuelve 204 al insertar. El redirector
usa exclusivamente la llave anon y hashes HMAC de IP/UA; ninguna credencial
privilegiada llega al navegador. La base vuelve a aplicar su sal privada.
El registro usa waitUntil cuando esta disponible; en otro runtime espera hasta
1500 ms y nunca impide redirigir. El fetch tiene un limite de cinco segundos,
sin reintentos automaticos.

Las solicitudes HEAD no insertan eventos. Los encabezados purpose, sec-purpose,
x-purpose, x-moz y sec-fetch-purpose que indican prefetch/prerender/preview
marcan `es_bot=true`, al igual que agentes de robots conocidos, herramientas y
UA ausente. La cadena WhatsApp sola es ambigua; no basta para afirmar que sea
un robot. **es_bot=false significa no detectado, no humano comprobado.**
Los hashes historicos no permiten reconstruir UA para reclasificarlos con
certeza; estas reglas mejoran solicitudes futuras. Un clic tampoco prueba
mensaje enviado, contacto, pago ni entrega en WhatsApp.

## Pruebas

1. `node --test pruebas/atribucion.test.cjs`
2. `postman simulation run postman/simulations/atribucion.sim.yaml --port 4917 --no-history --output ndjson`
3. En otra terminal PowerShell:

   ```powershell
   $env:CURSOSELECT_TEST_SIM_URL = 'http://127.0.0.1:4917/supabase'
   node --test pruebas/registro-http.test.cjs
   Remove-Item Env:CURSOSELECT_TEST_SIM_URL
   ```

La simulacion local se basa en las migraciones SQL 020/021, con respuestas
204/400/401/501 y registros falsos. No se busco un mock de propietario porque
el CLI local no tiene sesion Postman. El test ejecuta el handler y su fetch
real, no sustituye fetch por una funcion. Los eventos `request` en la salida
NDJSON acreditan las llamadas HTTP; no equivalen a probar Supabase real.
`/_pruebas/registros` existe solo en el stand-in para comprobar lo recibido.

En Windows, Postman CLI 1.75.0 fallo al iniciar dataset-daemon con
`Exception 0xc0000008 / openSecretPipes`, incluso con permiso a `.postman`.
Tambien el sandbox aisla loopback entre comandos. Para verificar mientras
se resuelve ese problema, `node --test pruebas/registro-http.test.cjs` sin
variable de entorno inicia el mismo stand-in en un puerto local aleatorio
dentro del proceso de pruebas. Sigue ejecutando HTTP y fetch reales, pero
ese resultado debe describirse como stand-in HTTP local, no Postman Simulation.

Pendiente de piloto real: conservar la referencia completa al abrir, editar,
enviar y copiar mensajes en WhatsApp Android, iPhone y Web. Si se borra o
corrompe, el origen debe quedar desconocido; no hay atribucion garantizada.

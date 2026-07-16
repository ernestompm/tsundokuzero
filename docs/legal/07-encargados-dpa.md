# Registro de encargados de tratamiento y DPA (RGPD art. 28)

*Documento interno del expediente de cumplimiento. Última revisión: 16 de julio de 2026.*

> ⚠️ **No archivar aquí el texto íntegro de los DPA**: este repositorio es público y los contratos de terceros no deben redistribuirse. Guardar los PDF en el archivo privado del titular (Drive/carpeta legal) y anotar aquí solo la ficha de revisión.

---

## 1. Vercel Inc. — alojamiento del frontend

**Documento revisado:** Data Processing Addendum de Vercel, versión «Last Updated March 17, 2026 / Effective March 31, 2026» (facilitado por el titular el 16/07/2026; disponible en vercel.com/legal).

**Ficha de la entidad (para el RAT):**
- Vercel Inc., sociedad de Delaware (n.º 5857312), 440 N Barranca Ave #4133, Covina, CA 91723 (EE. UU.)
- Contacto de privacidad: privacy@vercel.com
- Rol: **encargado** respecto de los datos que pasan por el servicio (p. ej. IPs de visitantes); **responsable** de sus propios datos de servicio y de cuenta.

**Puntos clave de la revisión:**

1. **🔴 Ámbito de aplicación — atención:** el DPA se aplica a clientes en planes **Enterprise y Pro**. Si Tsundoku Zero se sirve desde un plan **Hobby (gratuito), este DPA no lo cubre**, y además las condiciones del plan Hobby restringen el uso comercial.
   **Acción del titular:** comprobar el plan actual del proyecto en Vercel. Antes de abrir la beta al público: pasar a plan **Pro** (quedando cubierto por este DPA de forma automática) o documentar la cobertura contractual equivalente aplicable al plan actual.
2. **Transferencias internacionales:** tratamiento principal en EE. UU.; el DPA incorpora las **Cláusulas Contractuales Tipo 2021** (Módulo Dos responsable→encargado, ley irlandesa, autoridad: DPC irlandesa) por referencia al aceptar el contrato — no requiere firma separada. Cobertura adecuada para el cap. V RGPD.
3. **Subencargados:** autorización general; lista y ubicaciones en security.vercel.com (infraestructura sobre AWS, Azure y GCP).
   **Acción del titular:** enviar un email a privacy@vercel.com para **suscribirse a los avisos de nuevos subencargados** (el DPA da 5 días naturales para objetar).
4. **Medidas de seguridad (para el RAT/art. 32):** cifrado AES-256 en reposo y TLS 1.2+ en tránsito, SOC 2 Type 2 anual, pentesting anual, backups multi-región, mínimo privilegio. Informe de auditoría disponible bajo petición (satisface el derecho de auditoría).
5. **Notificación de brechas:** «sin dilación indebida» tras confirmar un incidente que afecte a Customer Data. La responsabilidad de notificar a la AEPD/afectados (arts. 33-34 RGPD) sigue siendo **del titular**.
6. **Fin del contrato = orden de supresión** de los datos en plazo comercialmente razonable.
7. **Responsabilidades del cliente** que el titular asume: obtener consentimientos/avisos (cubierto por la política de privacidad publicada), custodiar credenciales de la cuenta Vercel (activar 2FA), y mantener copias de seguridad propias.

**Conclusión:** DPA estándar y suficiente como contrato de encargo (art. 28.3) **una vez confirmado/contratado un plan cubierto (Pro o Enterprise)**. La política de privacidad publicada ya refleja a Vercel como encargado con CCT — coherente.

---

## 2. Supabase, Inc. — base de datos, auth y almacenamiento

**Estado: pendiente de la misma revisión.**

**Acciones del titular:**
1. Descargar el DPA de Supabase (supabase.com/legal/dpa — en los planes de pago se firma desde el dashboard; en el plan Free forma parte de las condiciones: verificar el ámbito igual que con Vercel).
2. Confirmar en el dashboard que la **región del proyecto `rigiljswurolsockpkfv` es UE** (eu-west) y anotarla aquí.
3. Anotar la ficha de revisión en este documento (misma estructura que la de Vercel).
4. Igual que con Vercel: valorar plan de pago antes de la beta abierta (el plan Free de Supabase pausa proyectos inactivos y no tiene SLA).

---

## 3. Recordatorios transversales

- Estas dos fichas alimentan el **registro de actividades de tratamiento** (art. 30): sección «destinatarios/encargados» y «transferencias internacionales».
- Si se añade un tercero nuevo (analítica, email marketing, CDN de imágenes…), pasa por esta misma revisión **antes** de integrarlo y actualiza la política de privacidad §5.
- Revisión anual de ambos DPA o cuando el proveedor notifique cambios.

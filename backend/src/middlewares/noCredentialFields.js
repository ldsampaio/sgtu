// T10: nenhuma rota do sgtu aceita campo de credencial.
//
// O sgtu não autentica credencial — autenticação é do saga. Rejeição explícita
// (não apenas ausência da rota): um corpo com campo de credencial nunca chega a
// um handler e nunca é registrado em log.
const CREDENTIAL_FIELDS = new Set([
  'password',
  'senha',
  'currentpassword',
  'current_password',
  'newpassword',
  'new_password',
  'confirmpassword',
  'confirm_password',
  'temporarypassword',
  'temp_password',
  'hash',
]);

function hasCredentialField(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  return Object.keys(body).some((k) => CREDENTIAL_FIELDS.has(String(k).toLowerCase()));
}

function rejectCredentialFields(req, res, next) {
  if (hasCredentialField(req.body)) {
    return res.status(400).json({
      code: 'CREDENTIAL_FIELD_NOT_ACCEPTED',
      message: 'O sgtu não aceita credencial. Autenticação é do saga.',
    });
  }
  next();
}

module.exports = { rejectCredentialFields, hasCredentialField, CREDENTIAL_FIELDS };

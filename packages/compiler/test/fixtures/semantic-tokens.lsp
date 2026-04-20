Definir Numero gValor;
Definir Cursor cur;
Definir Lista lst;

Definir Funcao fCustom(Numero End pRet, Numero pArg);
Funcao fCustom(Numero End pRet, Numero pArg);
Inicio
  Definir Numero lValor;
  lValor = 1;
  gValor = lValor;
  cur.SQL "SELECT campo1 FROM T";
  cur.AbrirCursor();
  cur.campo1 = 1;
  lst.AdicionarCampo("Campo1", Alfa);
  lst.Campo1 = "ok";
  fCustom(gValor, gValor);
  ConverteMascara(1, gValor, "a", "999");
  pRet = gValor;
Fim;

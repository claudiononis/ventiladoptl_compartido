sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/odata/v2/ODataModel",
    "sap/ui/export/Spreadsheet",
    "sap/ui/export/library",
  ],

  function (
    Controller,
    Filter,
    FilterOperator,
    JSONModel,
    ODataModel,
    Spreadsheet,
    exportLibrary
  ) {
    "use strict";

    return Controller.extend(
      "ventilado.ventiladoptl.controller.Logtransporte",
      {
        onInit: function () {
          this.getView().setModel(new JSONModel({ tableData: [] }));
        },
        onTransporteLinkPress: function (oEvent) {
          // Puedes obtener el valor si lo necesitas:
          var oContext = oEvent.getSource().getBindingContext();
          var sTransporte = oEvent.getSource().getText();
          var sOperador = oContext.getProperty("Operador");
          var sEstacion = oContext.getProperty("Estacion");

          // Guarda los valores en localStorage
          localStorage.setItem("transporte", sTransporte);
          localStorage.setItem("operador", sOperador);
          localStorage.setItem("estacion", sEstacion);
          localStorage.setItem("origen", "logtransporte");
          var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
          oRouter.navTo("RouteView1"); // Puedes pasar parámetros si lo necesitas
        },

        /*        onSearch: function () {
          var oView = this.getView();
          // Usá el model del componente si ya está configurado en manifest
          var oODataModel = new sap.ui.model.odata.v2.ODataModel(
            "/sap/opu/odata/sap/ZVENTILADO_SRV/"
          );

          // Fechas: con valueFormat="yyyy-MM-dd" en la view, getValue() ya devuelve eso.
          var sFrom = oView.byId("dpFrom").getValue(); // "yyyy-MM-dd" o ""
          var sTo = oView.byId("dpTo").getValue(); // "yyyy-MM-dd" o ""

          // Transporte: NO pad si está vacío
          var sTransporteRaw = oView.byId("inpTransporte").getValue(); // "" o "123"
          var sTransporte = sTransporteRaw
            ? sTransporteRaw.padStart(10, "0")
            : "";

          // Tipo (Radio): PTL | Tradicional | Ambos
          var iTipoIdx = this.byId("rbTipo").getSelectedIndex(); // 0,1,2
          var aTipos = ["PTL", "TRADICIONAL", "Ambos"];
          var sTipo = aTipos[iTipoIdx] || "Ambos";
          const sCentro = this.byId("inpCentro").getValue().trim(); // <- NUEVO
          var aFilters = [];

          // Fechainicio
          if (sFrom && sTo) {
            aFilters.push(
              new sap.ui.model.Filter(
                "Fechainicio",
                sap.ui.model.FilterOperator.BT,
                sFrom,
                sTo
              )
            );
          } else if (sFrom) {
            aFilters.push(
              new sap.ui.model.Filter(
                "Fechainicio",
                sap.ui.model.FilterOperator.GE,
                sFrom
              )
            );
          } else if (sTo) {
            aFilters.push(
              new sap.ui.model.Filter(
                "Fechainicio",
                sap.ui.model.FilterOperator.LE,
                sTo
              )
            );
          }

          // Transporte
          if (sTransporteRaw) {
            // ojo: usamos el RAW para decidir si filtrar
            aFilters.push(
              new sap.ui.model.Filter(
                "Transporte",
                sap.ui.model.FilterOperator.EQ,
                sTransporte
              )
            );
          }

          // Tipo (siempre; el backend ya interpreta "Ambos")
          aFilters.push(
            new sap.ui.model.Filter(
              "Campoadicional1",
              sap.ui.model.FilterOperator.EQ,
              sTipo
            )
          );

          var that = this;
          oODataModel.read("/ZVENTILADO_KPISet", {
            filters: aFilters,
            success: function (oData) {
              that
                .getView()
                .getModel()
                .setProperty("/tableData", oData.results || []);
            },
            error: function () {
              sap.m.MessageToast.show("Error al leer datos");
            },
          });
        },

        */
        onSearch: function () {
          var oView = this.getView();

          // Podés reutilizar el modelo del componente, pero mantengo tu creación explícita:
          var oODataModel = new sap.ui.model.odata.v2.ODataModel(
            "/sap/opu/odata/sap/ZVENTILADO_SRV/"
          );

          // Fechas (vienen como "yyyy-MM-dd" desde la view)
          var sFrom = oView.byId("dpFrom").getValue().trim();
          var sTo = oView.byId("dpTo").getValue().trim();

          // Transporte (trim y pad a 10 sólo si hay valor)
          var sTransporteRaw = oView.byId("inpTransporte").getValue().trim();
          var sTransporte = sTransporteRaw
            ? sTransporteRaw.padStart(10, "0")
            : "";

          // Centro (NUEVO)
          var sCentro = oView.byId("inpCentro").getValue().trim();

          // Tipo (Radio): PTL | TRADICIONAL | Ambos
          var iTipoIdx = this.byId("rbTipo").getSelectedIndex(); // 0,1,2
          var aTipos = ["PTL", "TRADICIONAL", "Ambos"];
          var sTipo = aTipos[iTipoIdx] || "Ambos";

          var aFilters = [];

          // Fechainicio
          if (sFrom && sTo) {
            aFilters.push(
              new sap.ui.model.Filter(
                "Fechainicio",
                sap.ui.model.FilterOperator.BT,
                sFrom,
                sTo
              )
            );
          } else if (sFrom) {
            aFilters.push(
              new sap.ui.model.Filter(
                "Fechainicio",
                sap.ui.model.FilterOperator.GE,
                sFrom
              )
            );
          } else if (sTo) {
            aFilters.push(
              new sap.ui.model.Filter(
                "Fechainicio",
                sap.ui.model.FilterOperator.LE,
                sTo
              )
            );
          }

          // Transporte (usa el RAW para decidir si filtrar)
          if (sTransporteRaw) {
            aFilters.push(
              new sap.ui.model.Filter(
                "Transporte",
                sap.ui.model.FilterOperator.EQ,
                sTransporte
              )
            );
          }

          // Centro (NUEVO)
          if (sCentro) {
            // Si querés prefijo en vez de exacto: usa StartsWith
            aFilters.push(
              new sap.ui.model.Filter(
                "Campoadicional2",
                sap.ui.model.FilterOperator.EQ,
                sCentro
              )
            );
          }

          // Tipo (siempre; el backend interpreta "Ambos")
          aFilters.push(
            new sap.ui.model.Filter(
              "Campoadicional1",
              sap.ui.model.FilterOperator.EQ,
              sTipo
            )
          );

          var that = this;
          oODataModel.read("/ZVENTILADO_KPISet", {
            filters: aFilters, // AND por defecto
            success: function (oData) {
              that
                .getView()
                .getModel()
                .setProperty("/tableData", oData.results || []);
            },
            error: function () {
              sap.m.MessageToast.show("Error al leer datos");
            },
          });
        },

        onRowSelect: function (oEvent) {
          var oCheckBox = oEvent.getSource();
          var bSelected = oCheckBox.getSelected();
          var oContext = oCheckBox.getBindingContext();
          var oTable = this.byId("kpiTableDesktop");
          var iRowIndex = oTable.indexOfRow(oCheckBox.getParent());
          var oRow = oTable.getRows()[iRowIndex];
          // Actualiza el modelo
          oContext
            .getModel()
            .setProperty(oContext.getPath() + "/selected", bSelected);
          // Remarca visualmente la fila
          if (oRow && oRow.$().length) {
            if (bSelected) {
              oRow.$().addClass("logTransporteRowSelected");
            } else {
              oRow.$().removeClass("logTransporteRowSelected");
            }
          }
        },
        onDownloadExcelCrudo: function () {
          var oTable = this.byId("kpiTableDesktop");
          var oBinding = oTable && oTable.getBinding("rows");
          if (!oBinding) {
            return;
          }

          // Obtener todos los repartos visibles
          var aContexts = oBinding.getContexts(0, Infinity);
          var aRepartos = Array.from(
            new Set(
              aContexts
                .map(function (ctx) {
                  var reparto = ctx.getObject().Transporte;
                  return reparto ? reparto.padStart(10, "0") : null;
                })
                .filter(Boolean)
            )
          );

          if (aRepartos.length === 0) {
            sap.m.MessageToast.show("No hay repartos visibles para descargar.");
            return;
          }

          var oODataModel = new sap.ui.model.odata.v2.ODataModel(
            "/sap/opu/odata/sap/ZVENTILADO_SRV/"
          );
          var aFilters = [
            new sap.ui.model.Filter({
              path: "Transporte",
              operator: sap.ui.model.FilterOperator.EQ,
              value1: aRepartos[0],
            }),
          ];
          if (aRepartos.length > 1) {
            for (var i = 1; i < aRepartos.length; i++) {
              aFilters.push(
                new sap.ui.model.Filter({
                  path: "Transporte",
                  operator: sap.ui.model.FilterOperator.EQ,
                  value1: aRepartos[i],
                })
              );
            }
            aFilters = [
              new sap.ui.model.Filter({
                filters: aFilters,
                and: false,
              }),
            ];
          }

          var that = this;
          oODataModel.read("/zlog_ventiladoSet", {
            filters: aFilters,
            success: function (oData) {
              if (!oData.results || oData.results.length === 0) {
                sap.m.MessageToast.show(
                  "No se encontraron registros en zlog_ventilado."
                );
                return;
              }
              // Ordenar por Transporte y EventoNro
              var aSorted = oData.results.slice().sort(function (a, b) {
                if (a.Transporte < b.Transporte) return -1;
                if (a.Transporte > b.Transporte) return 1;
                // Si Transporte es igual, ordenar por EventoNro
                return (a.EventoNro || 0) - (b.EventoNro || 0);
              });
              // Formatear campo Hora (objeto con ms en milisegundos) como HH:MM:SS
              aSorted.forEach(function (item) {
                if (
                  item.Hora &&
                  typeof item.Hora === "object" &&
                  typeof item.Hora.ms === "number"
                ) {
                  var totalSeconds = Math.floor(item.Hora.ms / 1000);
                  var h = Math.floor(totalSeconds / 3600);
                  var m = Math.floor((totalSeconds % 3600) / 60);
                  var s = totalSeconds % 60;
                  item.Hora =
                    String(h).padStart(2, "0") +
                    ":" +
                    String(m).padStart(2, "0") +
                    ":" +
                    String(s).padStart(2, "0");
                } else if (!item.Hora) {
                  item.Hora = "";
                }
              });

              // Función para formatear fecha corregida para evitar desfase de zona horaria
              const fmtDate = (val) => {
                if (!val) return "";
                const d = new Date(val);
                if (isNaN(d)) return "";

                // Usar UTC para evitar problemas de zona horaria
                const p2 = (x) => String(x).padStart(2, "0");
                return `${p2(d.getUTCDate())}/${p2(
                  d.getUTCMonth() + 1
                )}/${d.getUTCFullYear()}`;
              };

              // Reemplazar Fecha por formato DD/MM/AAAA usando la función corregida
              aSorted.forEach(function (item) {
                item.Fecha = fmtDate(item.Fecha);
              });
              sap.ui.require(
                ["sap/ui/export/Spreadsheet", "sap/ui/export/library"],
                function (Spreadsheet, exportLibrary) {
                  var EdmType = exportLibrary.EdmType;
                  var aCols = Object.keys(oData.results[0] || {}).map(function (
                    key
                  ) {
                    return { label: key, property: key, type: EdmType.String };
                  });
                  // No agregar columna extra, solo exportar Fechainicio ya formateado
                  // aCols.unshift({
                  //   label: "Fecha",
                  //   property: "__Fecha",
                  //   type: EdmType.String,
                  // });
                  var oSheet = new Spreadsheet({
                    workbook: { columns: aCols },
                    dataSource: aSorted,
                    fileName: "zlog_ventilado_crudo.xlsx",
                  });
                  oSheet.build().finally(function () {
                    oSheet.destroy();
                  });
                }
              );
            },
            error: function () {
              sap.m.MessageToast.show("Error al leer datos de zlog_ventilado.");
            },
          });
        },
        onDownloadExcel: function () {
          const oTable = this.byId("kpiTableDesktop");
          const oBinding = oTable && oTable.getBinding("rows");
          if (!oBinding) {
            return;
          }

          // Carga dinámica para evitar "EdmType is not defined"
          sap.ui.require(
            ["sap/ui/export/Spreadsheet", "sap/ui/export/library"],
            (Spreadsheet, exportLibrary) => {
              const EdmType = exportLibrary.EdmType;

              const aContexts = oBinding.getContexts(0, Infinity);
              const aRaw = aContexts.map((c) => ({ ...c.getObject() }));

              const toNumber = (v) => {
                if (v === null || v === undefined || v === "") return null;
                const s = String(v).trim().replace(/\./g, "").replace(",", ".");
                const n = Number(s);
                return Number.isFinite(n) ? n : null;
              };

              // normalización (según tus campos)
              const aNum0 = [
                "Cantidaditem",
                "Cantidadean",
                "Cantidadentrega",
                "Cantidadcubeta",
                "Cantidadroll",
                "Cantidadpallet",
              ];
              const aNum2 = [
                "Kiloentrega",
                "Volumenentrega",
                "Duracionpreparacion",
                "Duracionneta",
                "Duracionfinal",
                "Tiempoproductivo",
                "Tiempopausa",
                "Tiempobruto",
              ];

              const fmtDate = (val) => {
                if (!val) return "";
                const d = new Date(val);
                if (isNaN(d)) return "";

                // Usar UTC para evitar problemas de zona horaria
                const p2 = (x) => String(x).padStart(2, "0");
                return `${p2(d.getUTCDate())}/${p2(
                  d.getUTCMonth() + 1
                )}/${d.getUTCFullYear()}`;
              };

              const aData = aRaw.map((o) => {
                aNum0.forEach((k) => (o[k] = toNumber(o[k])));
                aNum2.forEach((k) => (o[k] = toNumber(o[k])));
                o.__Fecha = fmtDate(o.Fechainicio);
                o.__Reparto = o.Transporte || "";
                o.__Operador = o.Operador || "";
                o.__Estacion = o.Estacion || "";
                o.__Centro = o.Campoadicional2 || "";
                return o;
              });

              const aCols = [
                { label: "Fecha", property: "__Fecha", type: EdmType.String },
                { label: "Op", property: "__Operador", type: EdmType.String },
                {
                  label: "Estacion",
                  property: "__Estacion",
                  type: EdmType.String,
                },
                {
                  label: "Reparto",
                  property: "__Reparto",
                  type: EdmType.String,
                },
                { label: "Centro", property: "__Centro", type: EdmType.String },
                {
                  label: "Kg Br",
                  property: "Kiloentrega",
                  type: EdmType.Number,
                  scale: 2,
                },
                {
                  label: "Volumen (m3)",
                  property: "Volumenentrega",
                  type: EdmType.Number,
                  scale: 3,
                },
                {
                  label: "Cant Unid.",
                  property: "Cantidaditem",
                  type: EdmType.Number,
                  scale: 0,
                },
                {
                  label: "Cant EANS",
                  property: "Cantidadean",
                  type: EdmType.Number,
                  scale: 0,
                },
                {
                  label: "Cant Clientes",
                  property: "Cantidadentrega",
                  type: EdmType.Number,
                  scale: 0,
                },
                {
                  label: "Cant Cubetas",
                  property: "Cantidadcubeta",
                  type: EdmType.Number,
                  scale: 0,
                },
                {
                  label: "Cant Roll",
                  property: "Cantidadroll",
                  type: EdmType.Number,
                  scale: 0,
                },
                {
                  label: "Cant Pallets",
                  property: "Cantidadpallet",
                  type: EdmType.Number,
                  scale: 0,
                },
                {
                  label: "T. Prep.",
                  property: "Duracionpreparacion",
                  type: EdmType.Number,
                  scale: 2,
                },
                {
                  label: "T. Scan",
                  property: "Duracionneta",
                  type: EdmType.Number,
                  scale: 2,
                },
                {
                  label: "T. Final",
                  property: "Duracionfinal",
                  type: EdmType.Number,
                  scale: 2,
                },
                {
                  label: "T. Product.",
                  property: "Tiempoproductivo",
                  type: EdmType.Number,
                  scale: 2,
                },
                {
                  label: "T. Pausa",
                  property: "Tiempopausa",
                  type: EdmType.Number,
                  scale: 2,
                },
                {
                  label: "T. Total Bruto",
                  property: "Tiempobruto",
                  type: EdmType.Number,
                  scale: 2,
                },
              ];

              const oSheet = new Spreadsheet({
                workbook: { columns: aCols },
                dataSource: aData,
                fileName: "LogTransporte.xlsx",
              });
              oSheet.build().finally(() => oSheet.destroy());
            }
          );
        },
      }
    );
  }
);

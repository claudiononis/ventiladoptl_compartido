sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/odata/v2/ODataModel"
], function (Controller, Filter, FilterOperator, JSONModel,ODataModel) {
    "use strict";

    return Controller.extend("ventilado.ventiladoptl.controller.Logtransporte", {
        onInit: function () {
            this.getView().setModel(new JSONModel({ tableData: [] }));
        },

        onSearch: function () {
            var oView = this.getView();
           // var oODataModel = this.getOwnerComponent().getModel(); // OData v2 model definido en manifest.json
var oODataModel = new ODataModel("/sap/opu/odata/sap/ZVENTILADO_SRV/");
            var sFrom = oView.byId("dpFrom").getValue();
            var sTo = oView.byId("dpTo").getValue();
            var sTransporte = oView.byId("inpTransporte").getValue();

            var aFilters = [];

            if (sFrom && sTo) {
                aFilters.push(new Filter("Fecha", FilterOperator.BT, sFrom, sTo));
            }
            if (sTransporte) {
                aFilters.push(new Filter("Transporte", FilterOperator.EQ, sTransporte));
            }

            var that = this;
            oODataModel.read("/ZVENTILADO_KPISet", {
                filters: aFilters,
                success: function (oData) {
                    // cargo los resultados en el JSONModel de la vista
                    that.getView().getModel().setProperty("/tableData", oData.results);
                },
                error: function (oError) {
                    sap.m.MessageToast.show("Error al leer datos");
                }
            });
        }
    });
});
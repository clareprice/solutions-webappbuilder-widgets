///////////////////////////////////////////////////////////////////////////
// Copyright © 2014 Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////

define([
    'dijit/registry',
    'dojo/query',
    'dojo/dom-construct',
    'jimu/dijit/ImageChooser',
    'dojo/_base/declare',
    'dijit/_WidgetsInTemplateMixin',
    'dijit/Editor',
    'jimu/BaseWidgetSetting',
    'jimu/dijit/SimpleTable',
    'jimu/LayerInfos/LayerInfos',
    'dijit/form/Button',
    'dijit/form/Select',
    'dijit/form/ValidationTextBox',
    'dijit/form/CheckBox',
    'jimu/dijit/Message',
    'jimu/dijit/LoadingShelter',
    'jimu/dijit/Filter',
    'jimu/dijit/Popup',
    'jimu/dijit/_FeaturelayerServiceChooserContent',
    'esri/request',
    'esri/symbols/jsonUtils',
    'dijit/TooltipDialog',
    'dijit/popup',
    'dojo/_base/lang',
    'dojo/on',
    'dojox/gfx',
    'dojo/dom-class',
    'dojo/Deferred',
    'dojo/dom-style',
    'dojo/query',
    'dojo/_base/html',
    'dojo/_base/array',
    'dojo/sniff',
    './MySymbolPicker'
],
  function (
    registry,
    query,
    domConstruct,
    ImageChooser,
    declare,
    _WidgetsInTemplateMixin,
    Editor,
    BaseWidgetSetting,
    Table,
    LayerInfos,
    Button,
    Select,
    ValidationTextBox,
    CheckBox,
    Message,
    LoadingShelter,
    Filter,
    Popup,
    _FeaturelayerServiceChooserContent,
    esriRequest,
    jsonUtils,
    TooltipDialog,
    dijitPopup,
    lang,
    on,
    gfx,
    domClass,
    Deferred,
    domStyle,
    query,
    html,
    array,
    has,
    SymbolPicker
    ) {
    return declare([BaseWidgetSetting, _WidgetsInTemplateMixin], {
      baseClass: 'jimu-widget-511-setting',
      _layerInfos: null,
      _tableInfos: null,
      mpi: null,
      layer_options: [],
      refreshLayersCount: 0,
      refreshLayers: [],
      hasUpdatedInfo: false,

      // 1) Emit an event when a key property, that will require a widget update, changes
      // not sure if event or otherwise is best...basically I think I just need to know if the filter
      // or if the symbolData changes...if not I think the logic as is will just work
      // 2) Add cluster SVG behind the icon in the settings table
      // 3) Finish the remove of the second download script button
      // 4) Label should reset or clear on selection changed for the drop down?

      postCreate: function () {
        this.inherited(arguments);
        this._getAllLayers();
        this.own(on(this.btnAddLayer, 'click', lang.hitch(this, this._addLayerRow)));
        this.own(on(this.layerTable, 'actions-edit', lang.hitch(this, this._pickSymbol)));
      },

      startup: function () {
        this.inherited(arguments);
      },

      _getAllLayers: function () {
        if (this.map.itemId) {
          LayerInfos.getInstance(this.map, this.map.itemInfo)
            .then(lang.hitch(this, function (operLayerInfos) {
              this.opLayers = operLayerInfos;
              this._setLayers();
              this.setConfig(this.config);
            }));
        }
      },

      _setLayers: function () {
        var options = [];
        for (var i = 0; i < this.opLayers._layerInfos.length; i++) {
          var OpLyr = this.opLayers._layerInfos[i];

          if (OpLyr.newSubLayers.length > 0) {
            this._recurseOpLayers(OpLyr.newSubLayers, options);
          } else if (OpLyr.featureCollection) {
            if (OpLayer.layers.length > 1) {
              this._recurseOpLayers(OpLyr.layers, options);
            }
          } else {
            //TODO determine and pass in geom type here
            // should I also do the layer type and any of the other type work that is needed
            // by the widget here so that can all be done up front
            // in addition to that...should I also just fire off the queries to the datasources at this time??
            //  if we did that then we could basically just pass the layer instances to the widget...update the props as they change 
            //  and further minimize the delay we see on panel load...need to think through this further
            options.unshift({
              label: OpLyr.title,
              value: OpLyr.title,
              url: OpLyr.layerObject.url,
              use: OpLyr.use,
              imageData: OpLyr.imageData,
              id: OpLyr.id,
              type: OpLyr.type,
              renderer: OpLyr.layerObject.renderer
            });
          }
        }
        this.layer_options = lang.clone(options);
      },

      setConfig: function (config) {
        this.config = config;

        if (this.config.mainPanelText) {
          this.mainPanelText.set('value', this.config.mainPanelText);
        }
        if (this.config.mainPanelIcon) {
          this.panelMainIcon.innerHTML = this.config.mainPanelIcon;
        }

        if (this.config.refreshInterval) {
          this.refreshInterval.set('value', this.config.refreshInterval);
        }

        this.layerTable.clear();
        for (var i = 0; i < this.config.layerInfos.length; i++) {
          
          var lyrInfo = this.config.layerInfos[i];
          this._populateLayerRow(lyrInfo);
        }
      },

      _addLayerRow: function () {
        var result = this.layerTable.addRow({});
        if (result.success && result.tr) {
          var tr = result.tr;
          this._addLayersOption(tr);
          this._addLabelOption(tr);
          this._addRefreshOption(tr);
          this._addFilterOption(tr);
        }
      },

      _populateLayerRow: function (lyrInfo) {
        var result = this.layerTable.addRow({});
        if (result.success && result.tr) {
          var tr = result.tr;
          this._addLayersOption(tr);
          this._addLabelOption(tr);
          this._addRefreshOption(tr);
          this._addFilterOption(tr);
          tr.selectLayers.set("value", lyrInfo.layer);
          tr.labelText.set("value", lyrInfo.label);
          tr.refreshBox.set("checked", lyrInfo.refresh);

          var a = domConstruct.create("div", {
            class: "imageDataGFX",
            innerHTML: [lyrInfo.imageData],
            title: this.nls.iconColumnText
          }, tr.cells[3]);

          var cLo = this._getLayerOptionByValue(lyrInfo.layer);
          cLo.filter = lyrInfo.filter;
          cLo.imageData = lyrInfo.imageData;
          cLo.symbolData = lyrInfo.symbolData;
        }
      },

      _addLayersOption: function (tr) {
        var lyrOptions = lang.clone(this.layer_options);
        var td = query('.simple-table-cell', tr)[0];
        if (td) {
          html.setStyle(td, "verticalAlign", "middle");
          var tabLayers = new Select({
            style: {
              width: "100%",
              height: "28px"
            },
            options: lyrOptions
          });
          tabLayers.placeAt(td);
          tabLayers.startup();
          tr.selectLayers = tabLayers;
          this.own(on(tabLayers, 'change', lang.hitch(this, function (v) {
            //TODO...could keep track of value change
            // TODO...could also clear the label box here...still thinking if that is appropriate
          })));
        }
      },

      _addLabelOption: function (tr) {
        var td = query('.simple-table-cell', tr)[1];
        html.setStyle(td, "verticalAlign", "middle");
        var labelTextBox = new ValidationTextBox({
          style: {
            width: "100%",
            height: "28px"
          }
        });
        labelTextBox.placeAt(td);
        labelTextBox.startup();
        tr.labelText = labelTextBox;
      },

      _addRefreshOption: function (tr) {
        var td = query('.simple-table-cell', tr)[5];
        html.setStyle(td, "verticalAlign", "middle");
        var refreshCheckBox = new CheckBox({
          //style: {
          //  "padding-left": "10px"
          //},
          onChange: lang.hitch(this, function (v) {
            //TODO has to be a better way to do this
            // just need to know the row the hosts the cbx so we can get the layer value and
            //The other thought would be to do the type check while first adding the row
            //Then here we'd just need to check if this row has a url...if not then do the popup
            //that may be better....
            var ae = this.domNode.ownerDocument.activeElement;
            var value = ae.parentNode.parentNode.parentNode.selectLayers.value;

            if (v) {
              var lyrInfo = this._getLayerOptionByValue(value);
              if (typeof (lyrInfo.url) !== 'undefined' && lyrInfo.url !== '') {
                this.refreshLayers.push(value);
                var rO = query('.refreshOff', this.refreshOptions.domNode)[0];
                if(rO){
                  html.removeClass(rO, 'refreshOff');
                  html.addClass(rO, 'refreshOn');
                }
              } else {
                this.activeLayerInfo = lyrInfo;
                this._onSetUrlClick();
              }
            } else {
              var i = this.refreshLayers.indexOf(value);
              if (i > -1) {
                this.refreshLayers.splice(i, 1);

                if(this.refreshLayers.length === 0){
                  var rO = query('.refreshOn', this.refreshOptions.domNode)[0];
                  if(rO){
                    html.removeClass(rO, 'refreshOn');
                    html.addClass(rO, 'refreshOff');
                  }
                }
              }
            }
          })
        });
        refreshCheckBox.placeAt(td);
        refreshCheckBox.startup();
        tr.refreshBox = refreshCheckBox;

        //TODO disable for StreamLayer

      },

      _addFilterOption: function (tr) {
        var td = query('.simple-table-cell', tr)[4];
        var addFilterBtn = domConstruct.create("div", {
          class: "addFilterOn",
          title: this.nls.filterBtnTitle
        }, td);
        on(addFilterBtn, "click", lang.hitch(this, function (m) {
          var lo = this._getLayerOptionByValue(m.children[0].textContent);
          this._showFilter(lo.url);
        }, tr));
      },

      _onSetUrlClick: function () {
        this.serviceChooserContent = new _FeaturelayerServiceChooserContent({
          url: ""
        });
        this.shelter = new LoadingShelter({
          hidden: true
        });

        this.urlChooserPopup = new Popup({
          titleLabel: this.nls.urlPopupTitle,
          autoHeight: true,
          content: this.serviceChooserContent.domNode,
          container: window.jimuConfig.layoutId,
          width: 640
        });
        this.shelter.placeAt(this.urlChooserPopup.domNode);
        html.setStyle(this.serviceChooserContent.domNode, 'width', '580px');
        html.addClass(
          this.serviceChooserContent.domNode,
          'override-feature-service-chooser-content'
        );

        this.serviceChooserContent.own(
          on(this.serviceChooserContent, 'validate-click', lang.hitch(this, function () {
            html.removeClass(
              this.serviceChooserContent.domNode,
              'override-feature-service-chooser-content'
            );
          }))
        );
        this.serviceChooserContent.own(
          on(this.serviceChooserContent, 'ok', lang.hitch(this, this._onSelectUrlOk))
        );
        this.serviceChooserContent.own(
          on(this.serviceChooserContent, 'cancel', lang.hitch(this, this._onSelectUrlCancel))
        );
      },

      _onSelectUrlOk: function (evt) {
        if (!(evt && evt[0] && evt[0].url && this.domNode)) {
          return;
        }
        this.shelter.show();
        esriRequest({
          url: evt[0].url,
          content: {
            f: 'json'
          },
          handleAs: 'json',
          callbackParamName: 'callback'
        }).then(lang.hitch(this, function (response) {
          this.shelter.hide();
          if (response) {
            this.activeLayerInfo.url = evt[0].url;
            this.refreshLayers.push(this.activeLayerInfo.value);
            var rO = query('.refreshOff', this.refreshOptions.domNode)[0];
            if (rO) {
              html.removeClass(this.refreshOptions.domNode, 'refreshOff');
              html.addClass(this.refreshOptions.domNode, 'refreshOn');
            }
            if (this.urlChooserPopup) {
              this.urlChooserPopup.close();
              this.urlChooserPopup = null;
            }
          } else {
            new Message({
              message: this.nls.invalidUrlTip
            });
          }
        }), lang.hitch(this, function (err) {
          console.error(err);
          this.shelter.hide();
          new Message({
            message: this.nls.invalidUrlTip
          });
        }));
      },

      _onSelectUrlCancel: function () {
        if (this.urlChooserPopup) {
          this.urlChooserPopup.close();
          this.urlChooserPopup = null;
        }
      },

      _getLayerOptionByValue: function (value) {
        for (var i = 0; i < this.layer_options.length; i++) {
          var lo = this.layer_options[i];
          if (lo.value === value) {
            return lo;
          }
        }
      },

      _getLayerOptionByURL: function (url) {
        for (var i = 0; i < this.layer_options.length; i++) {
          var lo = this.layer_options[i];
          if (lo.url === url) {
            return lo;
          }
        }
      },

      _showFilter: function (url) {
        var filter = new Filter({
          noFilterTip: this.nls.noFilterTip,
          style: "width:100%;margin-top:22px;"
        });

        var filterPopup = new Popup({
          titleLabel: this.nls.filterPopupTitle,
          width: 680,
          height: 485,
          content: filter,
          buttons: [{
            label: this.nls.popupOk,
            onClick: lang.hitch(this, function () {
              var partsObj = filter.toJson();
              if (partsObj && partsObj.expr) {
                var lo = this._getLayerOptionByURL(filter.url);
                lo.filter = partsObj;
                filterPopup.close();
                filterPopup = null;
              } else {
                new Message({
                  message: this.nls.filterInvalid
                });
              }
            })
          }, {
            label: this.nls.popupCancel
          }]
        });

        var lyrO = this._getLayerOptionByURL(url);
        if (lyrO.hasOwnProperty('filter')) {
          filterObj = lyrO.filter;
          filter.buildByFilterObj(url, filterObj, null);
        } else {
          filter.buildByExpr(url, null, null);
        }
      },

      _recurseOpLayers: function (pNode, pOptions) {
        var nodeGrp = pNode;
        array.forEach(nodeGrp, lang.hitch(this, function (Node) {
          if (Node.newSubLayers.length > 0) {
            this._recurseOpLayers(Node.newSubLayers, pOptions);
          } else if (Node.featureCollection) {
            if (Node.layers.length > 1) {
              this._recurseOpLayers(Node.layers, pOptions);
            }
          } else {
            pOptions.push({
              label: Node.title,
              value: Node.title,
              url: Node.layerObject ? Node.layerObject.url : "",
              use: Node.use,
              imageData: Node.imageData,
              id: Node.id,
              type: Node.type,
              lyrObj: Node.layerObject
            });
          }
        }));
      },

      _pickSymbol: function (tr) {
        var selectLayersValue = tr.selectLayers.value;
        var lo = this._getLayerOptionByValue(selectLayersValue);
        this.curRow = tr;

        var options = {
          nls: this.nls,
          callerRow: tr,
          layerInfo: lo,
          value: selectLayersValue,
          symbolInfo: typeof(this.curRow.symbolData) !== 'undefined' ? this.curRow.symbolData : lo.symbolData,
          map: this.map
        };
        var sourceDijit = new SymbolPicker(options);

        var popup = new Popup({
          width: 625,
          autoHeight: true,
          content: sourceDijit,
          titleLabel: this.nls.sympolPopupTitle
        });

        this.own(on(sourceDijit, 'ok', lang.hitch(this, function (data) {
          this.curRow.cells[3].innerHTML = "<div></div>";
          this.curRow.symbolData = data;

          var newDiv = this._createImageDataDiv(data.icon);
          var r = this.layerTable.editRow(this.curRow, {
            imageData: newDiv.innerHTML
          });

          this.curRow = null;
          sourceDijit.destroy();
          sourceDijit = null;
          popup.close();
        })));

        this.own(on(sourceDijit, 'cancel', lang.hitch(this, function () {
          this.curRow = null;
          sourceDijit.destroy();
          sourceDijit = null;
          popup.close();
        })));
      },

      _createImageDataDiv: function (sym) {
        var symbol = jsonUtils.fromJson(sym);
        var a;

        if (symbol) {
          if (typeof (symbol.setWidth) !== 'undefined') {
            symbol.setWidth(27);
            symbol.setHeight(27);
          } else {
            if (symbol.size > 20) {
              symbol.setSize(20);
            }
          }

          a = domConstruct.create("div", { class: "imageDataGFX" }, this.curRow.cells[3]);
          var mySurface = gfx.createSurface(a, 28, 28);
          var descriptors = jsonUtils.getShapeDescriptors(symbol);
          var shape = mySurface.createShape(descriptors.defaultShape)
                        .setFill(descriptors.fill)
                        .setStroke(descriptors.stroke);
          shape.applyTransform({ dx: 14, dy: 14 });
        } else if (typeof(sym.url) !== 'undefined') {
          a = domConstruct.create("div", { class: "imageDataGFX" }, this.curRow.cells[3]);
          domStyle.set(a, "background-image", "url(" + sym.url + ")");
        }
        return a;
      },

      uploadImage: function () {
        var reader = new FileReader();
        reader.onload = lang.hitch(this, function () {
          this.panelMainIcon.innerHTML = null;
          this.mpi = reader.result;
          domConstruct.create("div", {
            innerHTML: ['<img class="t" src="', reader.result,
                        '" title="', escape(this.nls.mainPanelIcon), '"/>'].join('')
          }, this.panelMainIcon);
        });

        this.fileInput.onchange = lang.hitch(this, function () {
          var f = this.fileInput.files[0];
          reader.readAsDataURL(f);
        });

        this.fileInput.click();
      },

      downloadRefreshConfig: function () {
        alert("Code to download the config based on widget config goes here");
      },

      downloadRefreshScript: function () {
        alert("Easy way for the user to get the script goes here");
      },

      getConfig: function () {
        dijitPopup.close();

        var rows = this.layerTable.getRows();
        var table = [];
        var lInfo;
        array.forEach(rows, lang.hitch(this, function (tr) {
          var selectLayersValue = tr.selectLayers.value;

          var labelText = tr.labelText;
          var refreshBox = tr.refreshBox;
          var lo = this._getLayerOptionByValue(selectLayersValue);

          lInfo = {
            layer: selectLayersValue,
            label: labelText.value !== "" ? labelText.value : selectLayersValue,
            refresh: refreshBox.checked,
            filter: lo.filter,
            url: lo.url,
            type: lo.type,
            id: lo.id,
            symbolData: tr.symbolData
          };

          var td = query('.imageDataGFX', tr)[0];
          lInfo.imageData = typeof (td) !== 'undefined' ? td.innerHTML : "<div></div>";
          table.push(lInfo);
        }));

        this.config.layerInfos = table;
        this.config.mainPanelText = this.mainPanelText.value;
        this.config.mainPanelIcon = this.panelMainIcon.innerHTML;
        this.config.refreshInterval = this.refreshInterval.value;

        if (this.refreshLayersCount > 0) {
          this.config.refreshEnabled = true;
        }

        return this.config;
      },

      destroy: function () {
        dijitPopup.close();
        this.inherited(arguments);
      }
    });
  });

/*
 * Copyright 2007-2013 Charles du Jeu - Abstrium SAS <team (at) pyd.io>
 * This file is part of Pydio.
 *
 * Pydio is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Pydio is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Pydio.  If not, see <http://www.gnu.org/licenses/>.
 *
 * The latest code can be found at <http://pyd.io/>.
 */

Class.create("CartManager", FetchedResultPane, {

    __maxChildren: 100,
    __label:MessageHash["action.cart.9"],

    initialize: function($super, element, options){

        options = Object.extend({
            displayMode: 'detail',
            selectable: true
        }, options);
        $super(element, options);

        if(options.label) this.__label = options.label;
        element.ajxpNode = this._rootNode;
        element.applyDragMove = this.applyDragMove.bind(this);
        AjxpDroppables.add(element, this._rootNode);

        ajaxplorer.observe("server_message", function(event){
            var newValue = XPathSelectSingleNode(event, "nodes_diff/update|nodes_diff/remove");
            if(newValue && this._dataLoaded){
                // Remove or update selection if node has been removed!
            }
        }.bind(this));

        this.updateTitle();

    },

    updateTitle: function(){
        this.htmlElement.fire("widget:updateTitle", this.__label+' ('+this._rootNode.getChildren().size()+')');
    },

    downloadContent: function(){
        var h = this.getLocalSelectionForPosting();
        if(h.size() == 0) return;

        if(!$("download_form")) return;

        var form = $('download_form');
        form.action = window.ajxpServerAccessPath;
        form.secure_token.value = Connexion.SECURE_TOKEN;
        form.select("input").each(function(input){
            if(input.name!='get_action' && input.name!='secure_token') input.remove();
        });
        h.set('dir', '__AJXP_ZIP_FLAT__/');
        h.each(function(pair){
            form.insert(new Element('input', {type:'hidden', name:pair.key, value:pair.value}));
        });
        try{
            form.submit();
        }catch(e){

        }
    },

    compressContentAndShare: function(){

        var h = this.getLocalSelectionForPosting();
        if(h.size() == 0) return;
        if((zipEnabled && multipleFilesDownloadEnabled))
        {

            var zipName = window.prompt(MessageHash['action.cart.14'], this.__label);
            var index=1;
            var buff = zipName;
            while(ajaxplorer.getContextHolder().fileNameExists(zipName + ".zip", true, ajaxplorer.getContextHolder().getRootNode())){
                zipName = buff + "-" + index; index ++ ;
            }
            h.set('get_action', 'compress');
            h.set('compress_flat', 'true');
            h.set('dir', '/');
            h.set('archive_name', zipName + ".zip");
            var conn = new Connexion();
            conn.setMethod("POST");
            conn.setParameters(h);
            conn.onComplete = function(transport){
                var success = ajaxplorer.actionBar.parseXmlMessage(transport.responseXML);
                if(success){
                    ajaxplorer.goTo('/'+zipName+'.zip');
                    window.setTimeout(function(){
                        ajaxplorer.actionBar.fireAction('share');
                    }, 500);
                }
            }.bind(this);
            conn.sendAsync();
        }

    },

    addCurrentSelection: function(){

        ajaxplorer.getContextHolder().getSelectedNodes().each(function(n){
            if(n.isLeaf()){
                this.localNodeFromRemoteNode(n);
            }else{
                this.recurseLeafs(n);
            }
            this.updateTitle();
        }.bind(this));

    },

    getLocalSelectionForPosting:function(){

        var sel = new $H();
        var i = 0;
        this._rootNode.getChildren().each(function(n){
            var key = "file_" + i;
            sel.set(key, n.getPath());
            i++;
        });
        return sel;

    },

    getRootNode: function(){
        return this._rootNode;
    },

    /**
     * Can be overriden by the children.
     * @param ajxpOptions
     * @returns {AjxpDataModel}
     */
    initDataModel: function(ajxpOptions){

        var dataModel = new AjxpDataModel(true);
        var rNodeProvider = new LocalCartNodeProvider();
        dataModel.setAjxpNodeProvider(rNodeProvider);
        rNodeProvider.initProvider(ajxpOptions.nodeProviderProperties);
        this._rootNode = new AjxpNode("/ajxp-local-cart", false, "Results", "folder.png", rNodeProvider);
        dataModel.setRootNode(this._rootNode);
        return dataModel;

    },

    localNodeFromRemoteNode: function(n){

        if(this._rootNode.findChildByPath(n.getPath())) return;
        var newNode = new AjxpNode(n.getPath(), n.isLeaf(), n.getLabel(), n.getIcon());
        newNode.setMetadata($H(Object.clone(n.getMetadata().toObject())));
        this._rootNode.addChild(newNode);

    },

    applyDragMove: function(srcName, targetName, nodeId, copy){

        if(srcName != 'ajxp-user-selection') return;
        this.addCurrentSelection();

    },

    recurseLeafs: function(node){

        if(this._rootNode.getChildren().length > this.__maxChildren) {
            this.updateTitle();
            ajaxplorer.displayMessage('ERROR', 'Stopping recursion: please do not select more than ' + this.__maxChildren + ' at once!');
            throw $break;
        }

        if(node.isLoaded()){
            node.getChildren().each(function(n){
                if(n.isLeaf()){
                    this.localNodeFromRemoteNode(n);
                }else{
                    this.recurseLeafs(n);
                }
            }.bind(this));
        }else{
            node.observeOnce("loaded", function(){
                this.recurseLeafs(node);
            }.bind(this));
            node.load();
        }

        this.updateTitle();

    }

});
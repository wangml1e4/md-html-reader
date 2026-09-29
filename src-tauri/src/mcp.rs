//! Local stdio MCP adapter. No listener, remote transport, or ambient workspace access.
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::io::{self, BufRead, Write};
use std::path::PathBuf;

fn revision(text: &str) -> String {
    format!("{:x}", Sha256::digest(text.as_bytes()))
}

pub struct Session {
    root: String,
    writable: bool,
}
impl Session {
    pub fn new(root: &str, writable: bool) -> Result<Self, String> {
        Ok(Self {
            root: crate::path_guard::workspace_root(root)?
                .to_string_lossy()
                .into_owned(),
            writable,
        })
    }
    fn path(&self, args: &Value) -> Result<String, String> {
        let path = args["path"].as_str().ok_or("path is required")?;
        let candidate = PathBuf::from(&self.root).join(path);
        crate::path_guard::document_file_in_workspace(&self.root, &candidate.to_string_lossy())
            .map(|p| p.to_string_lossy().into_owned())
    }
    fn call(&self, name: &str, args: &Value) -> Result<Value, String> {
        match name {
            "list_documents" => Ok(json!(crate::fs_handler::list_workspace_files(
                self.root.clone()
            )?)),
            "search_documents" => Ok(json!(crate::search::search_content(
                self.root.clone(),
                args["query"].as_str().ok_or("query is required")?.into(),
                Some(100)
            )?)),
            "read_document" => {
                let path = self.path(args)?;
                let content = crate::fs_handler::read_file(self.root.clone(), path.clone())?;
                Ok(json!({ "path": path, "revision": revision(&content), "content": content }))
            }
            "write_document" => {
                if !self.writable {
                    return Err("Write access is disabled. Restart with --allow-write after workspace owner authorization.".into());
                }
                let path = self.path(args)?;
                let content = args["content"].as_str().ok_or("content is required")?;
                let previous = crate::fs_handler::read_file(self.root.clone(), path.clone())?;
                if args["revision"].as_str() != Some(revision(&previous).as_str()) {
                    return Err("Revision conflict; read the document again before writing.".into());
                }
                crate::fs_handler::write_file_checked(
                    self.root.clone(),
                    path,
                    content.into(),
                    previous,
                )?;
                Ok(json!({ "revision": revision(content), "saved": true }))
            }
            _ => Err("Unknown tool".into()),
        }
    }
    pub fn handle(&self, request: Value) -> Option<Value> {
        let id = request.get("id")?.clone();
        let result = match request["method"].as_str().unwrap_or("") {
            "initialize" => {
                json!({ "protocolVersion": "2024-11-05", "capabilities": { "tools": {} }, "serverInfo": { "name": "markdown-reader", "version": "0.9.2" }, "instructions": "Only the explicitly configured workspace is accessible. Writes require --allow-write and a current revision. Unsaved UI drafts are not part of this disk interface." })
            }
            "ping" => json!({}),
            "tools/list" => {
                let mut list = vec![
                    json!({"name":"list_documents","description":"List authorized workspace documents","inputSchema":{"type":"object","properties":{}}}),
                    json!({"name":"read_document","description":"Read a workspace document and revision","inputSchema":{"type":"object","properties":{"path":{"type":"string"}},"required":["path"]}}),
                    json!({"name":"search_documents","description":"Search workspace document content","inputSchema":{"type":"object","properties":{"query":{"type":"string"}},"required":["query"]}}),
                ];
                if self.writable {
                    list.push(json!({"name":"write_document","description":"Replace an existing document only if its revision still matches","inputSchema":{"type":"object","properties":{"path":{"type":"string"},"content":{"type":"string"},"revision":{"type":"string"}},"required":["path","content","revision"]}}));
                }
                json!({"tools":list})
            }
            "tools/call" => match self.call(
                request["params"]["name"].as_str().unwrap_or(""),
                &request["params"]["arguments"],
            ) {
                Ok(result) => json!({"content":[{"type":"text","text":result.to_string()}]}),
                Err(error) => json!({"isError":true,"content":[{"type":"text","text":error}]}),
            },
            _ => {
                return Some(
                    json!({"jsonrpc":"2.0","id":id,"error":{"code":-32601,"message":"Method not found"}}),
                )
            }
        };
        Some(json!({"jsonrpc":"2.0","id":id,"result":result}))
    }
}
pub fn run(args: &[String]) -> Result<(), String> {
    let root = args
        .iter()
        .position(|a| a == "--workspace")
        .and_then(|i| args.get(i + 1))
        .ok_or("--workspace is required")?;
    let session = Session::new(root, args.iter().any(|a| a == "--allow-write"))?;
    let input = io::stdin();
    let mut output = io::stdout().lock();
    for line in input.lock().lines() {
        let line = line.map_err(|e| e.to_string())?;
        let response = match serde_json::from_str(&line) {
            Ok(request) => session.handle(request),
            Err(_) => Some(
                json!({"jsonrpc":"2.0","id":null,"error":{"code":-32700,"message":"Parse error"}}),
            ),
        };
        if let Some(value) = response {
            writeln!(output, "{}", value).map_err(|e| e.to_string())?;
            output.flush().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}
#[tauri::command]
pub fn mcp_configuration(workspace_path: String, allow_write: bool) -> Result<Value, String> {
    let root = crate::path_guard::workspace_root(&workspace_path)?;
    let binary = std::env::current_exe().map_err(|e| e.to_string())?;
    let mut args = vec![
        "--mcp".to_string(),
        "--workspace".into(),
        root.to_string_lossy().into_owned(),
    ];
    if allow_write {
        args.push("--allow-write".into());
    }
    Ok(json!({"mcpServers":{"markdown-reader":{"command":binary,"args":args}}}))
}

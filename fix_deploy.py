with open("/home/opc/appterraform/frontend/app/deploy/page.tsx", "r") as f:
    content = f.read()

old = '} else if (msg.type === "done") {\n        setOutputs(msg.outputs || {});\n        setPhase("done");\n        ws.close();'
new = '} else if (msg.type === "done") {\n        if (!msg.success) {\n          setLogs((prev) => [...prev, "Apply failed"]);\n          setPhase("error");\n          ws.close();\n          return;\n        }\n        setOutputs(msg.outputs || {});\n        setPhase("done");\n        ws.close();'
content = content.replace(old, new)

old2 = '{phase === "done" && Object.keys(outputs).length > 0 && ('
new2 = '{phase === "done" && ('
content = content.replace(old2, new2)

with open("/home/opc/appterraform/frontend/app/deploy/page.tsx", "w") as f:
    f.write(content)
print("DONE")

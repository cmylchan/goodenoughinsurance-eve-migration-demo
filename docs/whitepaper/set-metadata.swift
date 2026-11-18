import PDFKit
let path = CommandLine.arguments[1]
let url = URL(fileURLWithPath: path)
guard let doc = PDFDocument(url: url) else { fatalError("cannot open") }
var attrs = doc.documentAttributes ?? [:]
attrs[PDFDocumentAttribute.titleAttribute] = "One Golden Path for AI Agents at GoodEnough Home Insurance"
attrs[PDFDocumentAttribute.authorAttribute] = "Christopher Chan"
attrs[PDFDocumentAttribute.subjectAttribute] = "Interview exercise: moving GoodEnough Home Insurance's AI agents onto one reviewed path on Vercel. Not an official Vercel publication."
attrs[PDFDocumentAttribute.creatorAttribute] = "Christopher Chan"
attrs[PDFDocumentAttribute.keywordsAttribute] = ["Vercel", "AI agents", "AI Gateway", "Vercel Workflow", "OIDC", "Vault", "interview exercise"]
doc.documentAttributes = attrs
let tmp = url.deletingLastPathComponent().appendingPathComponent(".meta-tmp.pdf")
guard doc.write(to: tmp) else { fatalError("write failed") }
_ = try FileManager.default.replaceItemAt(url, withItemAt: tmp)
print("metadata set, pages: \(doc.pageCount)")

"use client";

import {
  Defs,
  Document,
  LinearGradient,
  Page,
  PDFDownloadLink,
  Image as PDFImage,
  Rect,
  Stop,
  StyleSheet,
  Svg,
  Text,
  View,
  Line,
} from "@react-pdf/renderer";
import { sanitizeChave } from "../components/PhotoSession";

const pdfStyles = StyleSheet.create({
  page: {
    padding: 0,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  // O Container agora representa a peça física que será cortada + a sangria externa
  cardWrapper: {
    width: "258.5pt", // 91.2mm (85.2mm + 3mm cada lado)
    height: "170.5pt", // 60.2mm (54.2mm + 3mm cada lado)
    position: "relative",
  },
  // A área de conteúdo real (85x54mm) centralizada no wrapper
  safeArea: {
    position: "absolute",
    top: "8.5pt",  // 3mm de margem de sangria
    left: "8.5pt", // 3mm de margem de sangria
    width: "241.5pt", // 85.2mm exatos
    height: "153.5pt", // 54.2mm exatos
    flexDirection: "column",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10pt 10pt 5pt 10pt",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  shield: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
  },
  titleGroup: {
    flexDirection: "column",
  },
  subTitle: {
    color: "#e0e0e0",
    fontSize: 6,
    fontWeight: "bold",
  },
  mainTitle: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "black",
  },
  qrCode: {
    width: 40,
    height: 40,
    backgroundColor: "#FFFFFF",
    borderRadius: 4,
  },
  content: {
    flexDirection: "row",
    padding: "0 10pt 8pt 10pt",
    gap: 8,
  },
  photoBox: {
    width: 50,
    height: 63,
    backgroundColor: "#FFFFFF",
    borderRadius: 5,
    flexShrink: 0,
  },
  fields: {
    flex: 1,
    flexDirection: "column",
    gap: 4,
  },
  fieldRow: {
    backgroundColor: "#FFFFFF",
    borderRadius: 4,
    padding: "2pt 5pt",
    flexDirection: "row",
    alignItems: "center",
  },
  label: {
    fontSize: 5,
    color: "#979797",
    fontWeight: "bold",
  },
  value: {
    fontSize: 5,
    color: "#000000",
    fontWeight: "bold",
    marginLeft: 3,
  },
  footer: {
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: "4pt",
    position: "absolute",
    bottom: 0,
    width: "100%",
  },
  footerText: {
    color: "#cccccc",
    fontSize: 6,
  },
});

const CardPDF = ({ student, qrCodeUrl, photoUrl, cardAno, cardValorPerda }: any) => {
  const bleed = 8.5; // 3mm em pontos
  const cardW = 241.5; // 85mm
  const cardH = 153.5; // 54mm
  const totalW = cardW + (bleed * 2);
  const totalH = cardH + (bleed * 2);

  return (
    <View style={pdfStyles.cardWrapper}>
      {/* Background que "vaza" para a área de sangria */}
      <Svg width={totalW} height={totalH} style={{ position: "absolute" }}>
        <Defs>
          <LinearGradient id="cardGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#000000" />
            <Stop offset="55%" stopColor="#919191" />
            <Stop offset="100%" stopColor="#000000" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={totalW} height={totalH} fill="url('#cardGrad')" />
        
        {/* Linhas de Guia Pontilhadas (Opcionais para visualização do corte) */}
        <Rect 
          x={bleed} 
          y={bleed} 
          width={cardW} 
          height={cardH} 
          stroke="#ff0000" 
          strokeDasharray="4" 
          strokeWidth={0.8} 
        />
      </Svg>

      {/* Conteúdo na área segura (Safe Zone) */}
      <View style={pdfStyles.safeArea}>
        <View style={pdfStyles.header}>
          <View style={pdfStyles.headerLeft}>
            <PDFImage src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQrIjfyECBfinxjfTrBPgWRTRGsBitqvYWY3A&s" style={pdfStyles.shield} />
            <View style={pdfStyles.titleGroup}>
              <Text style={pdfStyles.subTitle}>Grêmio Recreativo</Text>
              <Text style={pdfStyles.mainTitle}>PROJETO PEREIRINHA</Text>
            </View>
          </View>
          {qrCodeUrl && <PDFImage src={qrCodeUrl} style={pdfStyles.qrCode} />}
        </View>

        <View style={pdfStyles.content}>
          {photoUrl ? (
            <PDFImage src={photoUrl} style={[pdfStyles.photoBox, { objectFit: 'cover' } as any]} />
          ) : (
            <View style={pdfStyles.photoBox} />
          )}

          <View style={pdfStyles.fields}>
            <View style={pdfStyles.fieldRow}><Text style={pdfStyles.label}>NOME:</Text><Text style={pdfStyles.value}>{student["ALUNO"]}</Text></View>
            <View style={{ flexDirection: "row", gap: 4 }}>
               <View style={[pdfStyles.fieldRow, { flex: 1 }]}><Text style={pdfStyles.label}>RG:</Text><Text style={pdfStyles.value}>{student["RG aluno"] || "—"}</Text></View>
               <View style={[pdfStyles.fieldRow, { flex: 1 }]}><Text style={pdfStyles.label}>CPF:</Text><Text style={pdfStyles.value}>{student["CPF"] || "—"}</Text></View>
            </View>
            <View style={{ flexDirection: "row", gap: 4 }}>
               <View style={[pdfStyles.fieldRow, { flex: 1 }]}><Text style={pdfStyles.label}>NASC:</Text><Text style={pdfStyles.value}>{student["Data Nasc"] || "—"}</Text></View>
               <View style={[pdfStyles.fieldRow, { flex: 1 }]}><Text style={pdfStyles.label}>MAT:</Text><Text style={pdfStyles.value}>{student["Nº Matric"] || "—"}</Text></View>
            </View>
            <View style={pdfStyles.fieldRow}><Text style={pdfStyles.label}>CAT:</Text><Text style={pdfStyles.value}>{student["Categoria"] || "—"}</Text></View>
            <View style={pdfStyles.fieldRow}><Text style={pdfStyles.label}>RESP:</Text><Text style={pdfStyles.value}>{student["Responsavel"] || "—"}</Text></View>
          </View>
        </View>

        <View style={pdfStyles.footer}>
          <Text style={pdfStyles.footerText}>VALIDADE: {cardAno} — EM CASO DE PERDA: R$ {cardValorPerda}</Text>
        </View>
      </View>
    </View>
  );
};

const MyDocument = ({ data, qrCodes, sessionPhotos, cardAno, cardValorPerda }: any) => (
  <Document>
    {data.map((student: any, idx: number) => {
      const chave = sanitizeChave(student["Nº Matric"] || student["CPF"]);
      return (
        <Page key={idx} size="A4" style={pdfStyles.page}>
          <CardPDF 
            student={student} 
            qrCodeUrl={qrCodes[chave] || ""} 
            photoUrl={sessionPhotos[chave]} 
            cardAno={cardAno} 
            cardValorPerda={cardValorPerda} 
          />
        </Page>
      );
    })}
  </Document>
);

export default function PdfDownloadButton({ data, qrCodes, sessionPhotos, cardAno, cardValorPerda }: any) {
  // Lógica para dividir em lotes de 100
  const batchSize = 100;
  const batches = [];
  for (let i = 0; i < data.length; i += batchSize) {
    batches.push(data.slice(i, i + batchSize));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%" }}>
      {batches.map((batch, index) => (
        <PDFDownloadLink
          key={index}
          document={
            <MyDocument
              data={batch}
              qrCodes={qrCodes}
              sessionPhotos={sessionPhotos}
              cardAno={cardAno}
              cardValorPerda={cardValorPerda}
            />
          }
          fileName={`carteirinhas_parte_${index + 1}.pdf`}
          style={{ textDecoration: "none" }}
        >
          {({ loading }) => (
            <span style={{
              display: "block",
              padding: "12px",
              background: loading ? "#6c757d" : "#0070f3",
              color: "#fff",
              borderRadius: "8px",
              fontWeight: "bold",
              fontSize: "13px",
              textAlign: "center"
            }}>
              {loading ? `⏳ Preparando Parte ${index + 1}...` : `📄 Baixar Parte ${index + 1} (${batch.length} alunos)`}
            </span>
          )}
        </PDFDownloadLink>
      ))}
    </div>
  );
}
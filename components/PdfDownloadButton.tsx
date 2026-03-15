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
  usePDF,
  View,
} from "@react-pdf/renderer";
import{ sanitizeChave } from "../components/PhotoSession";


const pdfStyles = StyleSheet.create({
  page: {
    padding: 30,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
  },
  card: {
    width: "250pt",
    height: "153pt",
    marginBottom: 15,
    position: "relative",
    backgroundColor: "#000000",
    borderRadius: 14,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12pt 12pt 8pt 12pt",
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
    borderWidth: 1,
    borderColor: "#FFFFFF",
    backgroundColor: "#FFFFFF",
  },
  titleGroup: {
    flexDirection: "column",
  },
  subTitle: {
    color: "#e0e0e0",
    fontSize: 6,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  mainTitle: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "black",
  },
  qrCode: {
    width: 42,
    height: 42,
    backgroundColor: "#FFFFFF",
    padding: 0,
    borderRadius: 4,
  },
  content: {
    flexDirection: "row",
    padding: "0 12pt 8pt 12pt",
    gap: 8,
  },
  photoBox: {
    width: 58,
    height: 64,
    backgroundColor: "#FFFFFF",
    borderRadius: 3,
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
    textTransform: "uppercase",
  },
  value: {
    fontSize: 5,
    color: "#000000",
    fontWeight: "bold",
    textTransform: "uppercase",
    marginLeft: 3,
  },
  twoCol: {
    flexDirection: "row",
    gap: 4,
  },
  footer: {
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: "4pt 8pt",
    position: "absolute",
    bottom: 0,
    width: "100%",
  },
  footerText: {
    color: "#cccccc",
    fontSize: 5,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});

const CardPDF = ({
  student,
  qrCodeUrl,
  photoUrl,
  cardAno,
  cardValorPerda,
}: {
  student: any;
  qrCodeUrl: string;
  photoUrl?: string;
  cardAno: number;
  cardValorPerda: string;
}) => (
  <View style={pdfStyles.card}>
    <Svg
      viewBox="0 0 250 153"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
      }}
    >
      <Defs>
        <LinearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#000000" />
          <Stop offset="55%" stopColor="#919191" />
          <Stop offset="100%" stopColor="#000000" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url('#grad')" />
    </Svg>

    <View style={{ width: "100%", height: "100%" }}>
      <View style={pdfStyles.header}>
        <View style={pdfStyles.headerLeft}>
          <PDFImage
            src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQrIjfyECBfinxjfTrBPgWRTRGsBitqvYWY3A&s"
            style={pdfStyles.shield}
          />
          <View style={pdfStyles.titleGroup}>
            <Text style={pdfStyles.subTitle}>Grêmio Recreativo</Text>
            <Text style={pdfStyles.mainTitle}>PROJETO PEREIRINHA</Text>
          </View>
        </View>
        {qrCodeUrl && <PDFImage src={qrCodeUrl} style={pdfStyles.qrCode} />}
      </View>

      <View style={pdfStyles.content}>
        {photoUrl ? (
          <PDFImage src={photoUrl} style={pdfStyles.photoBox} />
        ) : (
          <View style={pdfStyles.photoBox} />
        )}

        <View style={pdfStyles.fields}>
          <View style={pdfStyles.fieldRow}>
            <Text style={pdfStyles.label}>Nome do Atleta</Text>
            <Text style={pdfStyles.value}>{student["ALUNO"]}</Text>
          </View>
          <View style={pdfStyles.twoCol}>
            <View style={[pdfStyles.fieldRow, { flex: 1 }]}>
              <Text style={pdfStyles.label}>RG</Text>
              <Text style={pdfStyles.value}>{student["RG aluno"] || "—"}</Text>
            </View>
            <View style={[pdfStyles.fieldRow, { flex: 1 }]}>
              <Text style={pdfStyles.label}>CPF</Text>
              <Text style={pdfStyles.value}>{student["CPF"] || "—"}</Text>
            </View>
          </View>
          <View style={pdfStyles.twoCol}>
            <View style={[pdfStyles.fieldRow, { flex: 1 }]}>
              <Text style={pdfStyles.label}>Nascimento</Text>
              <Text style={pdfStyles.value}>{student["Data Nasc"] || "—"}</Text>
            </View>
            <View style={[pdfStyles.fieldRow, { flex: 1 }]}>
              <Text style={pdfStyles.label}>Matrícula</Text>
              <Text style={pdfStyles.value}>{student["Nº Matric"] || "—"}</Text>
            </View>
          </View>
          <View style={pdfStyles.fieldRow}>
            <Text style={pdfStyles.label}>Categoria</Text>
            <Text style={pdfStyles.value}>{student["Categoria"] || "—"}</Text>
          </View>
          <View style={pdfStyles.fieldRow}>
            <Text style={pdfStyles.label}>Responsável</Text>
            <Text style={pdfStyles.value}>{student["Responsavel"] || "—"}</Text>
          </View>
        </View>
      </View>

      <View style={pdfStyles.footer}>
        <Text style={pdfStyles.footerText}>
          VALIDADE: {cardAno} — EM CASO DE PERDA: R$ {cardValorPerda}
        </Text>
      </View>
    </View>
  </View>
);

const MyDocument = ({
  data,
  qrCodes,
  sessionPhotos,
  cardAno,
  cardValorPerda,
}: {
  data: any[];
  qrCodes: Record<string, string>;
  sessionPhotos: Record<string, string>;
  cardAno: number;
  cardValorPerda: string;
}) => {
  const chunks: any[][] = [];
  for (let i = 0; i < data.length; i += 8) chunks.push(data.slice(i, i + 8));

  return (
    <Document>
      {chunks.map((chunk, pageIndex) => (
        <Page key={pageIndex} size="A4" style={pdfStyles.page}>
          {chunk.map((student, sIdx) => {
            const chave = sanitizeChave(student["Nº Matric"] || student["CPF"]);
            const qrKey = student["Nº Matric"] || student["CPF"];
            return (
              <CardPDF
                key={sIdx}
                student={student}
                qrCodeUrl={qrCodes[qrKey] || ""}
                photoUrl={sessionPhotos[chave]}
                cardAno={cardAno}
                cardValorPerda={cardValorPerda}
              />
            );
          })}
        </Page>
      ))}
    </Document>
  );
};


export { CardPDF, MyDocument, pdfStyles };

export default function PdfDownloadButton({
  data,
  qrCodes,
  sessionPhotos,
  cardAno,
  cardValorPerda,
}: {
  data: any[];
  qrCodes: Record<string, string>;
  sessionPhotos: Record<string, string>;
  cardAno: number;
  cardValorPerda: string;
}) {
  return (
    <PDFDownloadLink
      document={
        <MyDocument
          data={data}
          qrCodes={qrCodes}
          sessionPhotos={sessionPhotos}
          cardAno={cardAno}
          cardValorPerda={cardValorPerda}
        />
      }
      fileName="carteirinhas_pereirinha.pdf"
      style={{ textDecoration: "none", display: "block" }}
    >
      {({ loading, error }) => {
        if (error) console.error("Erro PDF:", error);
        return (
          <span
            style={{
              display: "block",
              padding: "14px 24px",
              background: loading ? "#6c757d" : "#0070f3",
              color: "#fff",
              borderRadius: "8px",
              fontWeight: "bold",
              fontSize: "14px",
              textAlign: "center",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "⏳ Gerando PDF..." : "📄 Baixar PDF das Carteirinhas"}
          </span>
        );
      }}
    </PDFDownloadLink>
  );
}

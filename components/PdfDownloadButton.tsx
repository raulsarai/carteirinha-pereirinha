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
} from "@react-pdf/renderer";
import { sanitizeChave } from "../components/PhotoSession";

const pdfStyles = StyleSheet.create({
  page: {
    paddingTop: 24,
    paddingBottom: 24,
    paddingHorizontal: 18,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignContent: "flex-start",
  },

  cardWrapper: {
    width: "258.5pt",
    height: "170.5pt",
    position: "relative",
    marginBottom: 10,
  },

  safeArea: {
    position: "absolute",
    top: "8.5pt",
    left: "8.5pt",
    width: "241.5pt",
    height: "153.5pt",
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

const CardPDF = ({
  student,
  qrCodeUrl,
  photoUrl,
  cardAno,
  cardValorPerda,
}: any) => {
  const bleed = 8.5;
  const cardW = 241.5;
  const cardH = 153.5;
  const totalW = cardW + bleed * 2;
  const totalH = cardH + bleed * 2;

  return (
    <View style={pdfStyles.cardWrapper}>
      <Svg width={totalW} height={totalH} style={{ position: "absolute" }}>
        <Defs>
          <LinearGradient id="cardGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#000000" />
            <Stop offset="55%" stopColor="#919191" />
            <Stop offset="100%" stopColor="#000000" />
          </LinearGradient>
        </Defs>

        <Rect
          x="0"
          y="0"
          width={totalW}
          height={totalH}
          fill="url('#cardGrad')"
        />
      </Svg>

      <View style={pdfStyles.safeArea}>
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

          {qrCodeUrl ? <PDFImage src={qrCodeUrl} style={pdfStyles.qrCode} /> : null}
        </View>

        <View style={pdfStyles.content}>
          {photoUrl ? (
            <PDFImage
              src={photoUrl}
              style={[pdfStyles.photoBox, { objectFit: "cover" } as any]}
            />
          ) : (
            <View style={pdfStyles.photoBox} />
          )}

          <View style={pdfStyles.fields}>
            <View style={pdfStyles.fieldRow}>
              <Text style={pdfStyles.label}>NOME:</Text>
              <Text style={pdfStyles.value}>{student["ALUNO"]}</Text>
            </View>

            <View style={{ flexDirection: "row", gap: 4 }}>
              <View style={[pdfStyles.fieldRow, { flex: 1 }]}>
                <Text style={pdfStyles.label}>RG:</Text>
                <Text style={pdfStyles.value}>{student["RG aluno"] || "—"}</Text>
              </View>
              <View style={[pdfStyles.fieldRow, { flex: 1 }]}>
                <Text style={pdfStyles.label}>CPF:</Text>
                <Text style={pdfStyles.value}>{student["CPF"] || "—"}</Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 4 }}>
              <View style={[pdfStyles.fieldRow, { flex: 1 }]}>
                <Text style={pdfStyles.label}>NASC:</Text>
                <Text style={pdfStyles.value}>{student["Data Nasc"] || "—"}</Text>
              </View>
              <View style={[pdfStyles.fieldRow, { flex: 1 }]}>
                <Text style={pdfStyles.label}>MAT:</Text>
                <Text style={pdfStyles.value}>{student["Nº Matric"] || "—"}</Text>
              </View>
            </View>

            <View style={pdfStyles.fieldRow}>
              <Text style={pdfStyles.label}>CAT:</Text>
              <Text style={pdfStyles.value}>{student["Categoria"] || "—"}</Text>
            </View>

            <View style={pdfStyles.fieldRow}>
              <Text style={pdfStyles.label}>RESP:</Text>
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
};

const chunkArray = (arr: any[], size: number) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

const MyDocument = ({
  data,
  qrCodes,
  sessionPhotos,
  cardAno,
  cardValorPerda,
}: any) => {
  const pages = chunkArray(data, 8);

  return (
    <Document>
      {pages.map((group: any[], pageIndex: number) => (
        <Page key={pageIndex} size="A4" style={pdfStyles.page}>
          {group.map((student: any, idx: number) => {
            const chave = sanitizeChave(student["Nº Matric"] || student["CPF"]);
            return (
              <CardPDF
                key={`${pageIndex}-${idx}`}
                student={student}
                qrCodeUrl={qrCodes[chave] || ""}
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

export default function PdfDownloadButton({
  data,
  qrCodes,
  sessionPhotos,
  cardAno,
  cardValorPerda,
}: any) {
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
      fileName="carteirinhas_8_por_pagina.pdf"
      style={{ textDecoration: "none", width: "100%" }}
    >
      {({ loading }) => (
        <span
          style={{
            display: "block",
            padding: "12px",
            background: loading ? "#6c757d" : "#0070f3",
            color: "#fff",
            borderRadius: "8px",
            fontWeight: "bold",
            fontSize: "13px",
            textAlign: "center",
          }}
        >
          {loading ? "⏳ Preparando PDF..." : "📄 Baixar PDF com 8 carteirinhas por página"}
        </span>
      )}
    </PDFDownloadLink>
  );
}